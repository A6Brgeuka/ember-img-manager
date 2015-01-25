import Ember from 'ember';
import ImgRule from '../utils/img-manager/img-rule';
import ImgSource from '../utils/img-manager/img-source';
import ENV from '../config/environment';

var map = Ember.EnumerableUtils.map;
var forEach = Ember.EnumerableUtils.forEach;
var filter = Ember.EnumerableUtils.filter;

function keyForSrc(src) {
  return '$$img-manager$$' + (src || '');
}

/**
 * @module img-manager
 * @class ImgManagerService
 * @extends Ember.Object
 */
export default Ember.Object.extend({
  /**
   * Our configuration
   * @property config
   * @type {Object}
   */
  config: Ember.computed(function () {
    return Ember.merge({
      maxTries: 1,
      loadingClass: 'loading',
      errorClass: 'error',
      successClass: 'success'
    }, Ember.get(ENV, 'imgManager'));
  }).readOnly(),

  /**
   * The default delay
   * @property defaultDelay
   * @type {number}
   */
  defaultDelay: Ember.computed.readOnly('config.delay'),

  /**
   * The default batch size
   * @property defaultBatchSize
   * @type {number}
   */
  defaultBatchSize: Ember.computed.readOnly('config.batchSize'),

  /**
   * The default max tries
   * @property defaultMaxTries
   * @type {number}
   */
  defaultMaxTries: Ember.computed.readOnly('config.maxTries', 1),

  /**
   * The default loading src
   * @property defaultLoadingSrc
   * @type {number}
   */
  defaultLoadingSrc: Ember.computed.readOnly('config.loadingSrc'),

  /**
   * The default error src
   * @property defaultErrorSrc
   * @type {number}
   */
  defaultErrorSrc: Ember.computed.readOnly('config.errorSrc'),

  /**
   * Default css class for the wrapper of a loading image
   * @property defaultLoadingClass
   * @type {string}
   */
  defaultLoadingClass: Ember.computed.readOnly('config.loadingClass'),

  /**
   * Default css class for the wrapper of an image which failed to load
   * @property defaultErrorClass
   * @type {string}
   */
  defaultErrorClass: Ember.computed.readOnly('config.errorClass'),

  /**
   * Default css class for the wrapper of an image which loaded successfully
   * @property defaultSuccessClass
   * @type {string}
   */
  defaultSuccessClass: Ember.computed.readOnly('config.successClass'),


  /**
   * Get the img source object for the given src
   *
   * @method imgSourceForSrc
   * @param {string} src
   * @return {ImgSource}
   */
  imgSourceForSrc: function (src) {
    var dict = this.get('_imgSources'),
      key = keyForSrc(src),
      imgSource = dict[key];
    if (!imgSource) {
      imgSource = dict[key] = ImgSource.create({
        src:     src,
        manager: this
      });
      this.incrementProperty('totalSources');
      imgSource.one('didError', Ember.run.bind(this, 'incrementProperty', 'totalErrors', 1));
    }
    return imgSource;
  },

  /**
   * Get or create a bare img node for the given source
   *
   * @method bareNodeFor
   * @param {string} src
   * @return {HTMLImageElement}
   */
  bareNodeFor: function (src) {
    var dict = this.get('_bareNodes'),
      key = keyForSrc(src),
      node = dict[key];
    if (!node) {
      node = dict[key] = document.createElement('img');
      if (src) {
        node.src = src;
      }
    }
    return node;
  },

  /**
   * Our free clones container
   * @property freeClonesContainer
   * @type {HTMLDivElement}
   */
  freeClonesContainer: Ember.computed(function () {
    return document.createElement('div');
  }).readOnly(),

  /**
   * Free clones that can be re-used
   * @property freeClones
   * @type {Object}
   */
  freeClones: Ember.computed(function () {
    return Object.create(null);
  }).readOnly(),

  /**
   * Get a free clone for the given src if any available
   *
   * @method freeCloneFor
   * @param {string} src
   * @param {boolean} [lock=true]
   * @return {HTMLImageElement}
   */
  freeCloneFor: function (src, lock) {
    var dict = this.get('freeClones'), key = keyForSrc(src);
    if (lock == null) {
      lock = true;
    }
    if (dict[key] && dict[key].length) {
      if (lock) {
        this.incrementProperty('totalFreeClones', -1);
        return dict[key].shift();
      }
      else {
        return dict[key][0];
      }
    }
  },

  /**
   * Get a clone for the given src
   *
   * @method cloneForSrc
   * @param {string} src
   * @param {Object|HTMLImageElement} attributes
   * @return {HTMLImageElement}
   */
  cloneForSrc: function (src, attributes) {
    var clone = this.freeCloneFor(src), attrNames, meta;
    if (!clone) {
      clone = this.bareNodeFor(src).cloneNode();
      Object.defineProperty(clone, '__imgManagerMeta', {
        value: {
          key:            keyForSrc(src),
          attributeNames: []
        }
      });
      this.get('freeClonesContainer').appendChild(clone);
    }
    attrNames = clone.__imgManagerMeta.attributeNames;
    if (attributes) {
      if (attributes instanceof Node) {
        // move attributes from the given node to the clone
        meta = attributes.__imgManagerMeta;
        forEach(attributes.attributes, function (attr) {
          if (meta.attributeNames.indexOf(attr.localName) !== -1) {
            attr = attributes.removeAttributeNode(attr);
            clone.setAttributeNode(attr);
            attrNames.push(attr.localName);
          }
        });
        // remove the names from the index
        meta.attributeNames = filter(meta.attributeNames, function (name) {
          return attrNames.indexOf(name) !== -1;
        });
      }
      else {
        // set attributes
        forEach(attributes, function (value, name) {
          if (name !== 'src' && value != null) {
            attrNames.push(name);
            if (clone.setAttribute) {
              clone.setAttribute(name, value);
            }
            else {
              clone[name] = value;
            }
          }
        });
      }
    }
    this.incrementProperty('totalUsedClones');
    this.incrementProperty('totalHits');
    return clone;
  },

  /**
   * Updates a clone attribute
   *
   * @method setCloneAttribute
   * @param {HTMLImageElement} clone
   * @param {string} name
   * @param {string} value
   */
  setCloneAttribute: function (clone, name, value) {
    var attrNames = clone.__imgManagerMeta.attributeNames, index = attrNames.indexOf(name);
    if (name === 'src') {
      return this.switchCloneForSrc(clone, value);
    }
    if (value == null) {
      if (index !== -1) {
        attrNames.splice(index, 1);
        clone.removeAttribute(name);
      }
    }
    else {
      if (index === -1) {
        attrNames.push(name);
        if (clone.setAttribute) {
          clone.setAttribute(name, value);
        }
        else {
          clone[name] = value;
        }
      }
    }
  },


  /**
   * Release a clone so that it's free for re-use
   *
   * @method releaseClone
   * @param {HTMLImageElement} clone
   */
  releaseClone: function (clone) {
    var meta = clone.__imgManagerMeta,
      opt = this.getProperties('freeClonesContainer', 'freeClones'),
      dict = opt.freeClones[meta.key];
    opt.freeClonesContainer.appendChild(clone);
    if (!dict) {
      dict = opt.freeClones[meta.key] = [];
    }
    dict.push(clone);
    forEach(meta.attributeNames, function (name) {
      clone.removeAttribute(name);
    });
    meta.attributeNames = [];
    this.incrementProperty('totalFreeClones');
    this.incrementProperty('totalUsedClones', -1);
  },

  /**
   * Switch a clone so that it is replaced by one of the good src
   *
   * @method switchCloneForSrc
   * @param {HTMLIFrameElement} clone
   * @param {string} newSrc
   */
  switchCloneForSrc: function (clone, newSrc) {
    var newKey = keyForSrc(newSrc), newClone, meta = clone.__imgManagerMeta;
    if (newKey !== meta.key) {
      newClone = this.cloneForSrc(newSrc, clone);
      clone.parentNode.replaceChild(newClone, clone);
      this.releaseClone(clone);
    }
  },


  /**
   * Contains all the rules
   * @property rules
   * @type {Ember.Array.<ImgRule>}
   */
  rules: Ember.computed(function () {
    var _this = this;
    var rules = Ember.A(map(this.get('config.rules') || [], function (ruleConfig) {
      return ImgRule.create({
        manager: _this,
        config:  ruleConfig
      });
    }));
    // add a default rule matching everything
    rules.pushObject(ImgRule.create({
      manager: this,
      config:  {match: '*'}
    }));
    return rules;
  }).readOnly(),


  /**
   * Get the first rule matching the given src
   *
   * @method ruleForSrc
   * @param {string} src
   * @return {ImgRule}
   */
  ruleForSrc: function (src) {
    return this.get('rules').find(function (rule) {
      return rule.test(src);
    });
  },

  /**
   * Total number of hits
   * @property totalHits
   * @type {number}
   */
  totalHits: 0,

  /**
   * Total number of errors
   * @property totalErrors
   * @type {number}
   */
  totalErrors: 0,

  /**
   * Total number of used clones
   * @property totalUsedClones
   * @type {number}
   */
  totalUsedClones: 0,

  /**
   * Total number of free clones
   * @property totalFreeClones
   * @type {number}
   */
  totalFreeClones: 0,

  /**
   * Total number of sources
   * @property totalSources
   * @type {number}
   */
  totalSources: 0,


  /**
   * All bare nodes created
   * @property _bareNodes
   * @type {Object}
   */
  _bareNodes: Ember.computed(function () {
    return Object.create(null);
  }).readOnly(),


  /**
   * All img source objects indexed by src
   * @property _imgSources
   * @type {Object}
   */
  _imgSources: Ember.computed(function () {
    return Object.create(null);
  }).readOnly()
});
