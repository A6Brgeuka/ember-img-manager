// Copied from https://github.com/twokul/ember-lazy-image but some improvements from @huafu_g:
// - added documentation
// - made it more Ember
// - fixed handlers
// - once `enteredViewport` has been set to `true`, remove all listeners
// - fixed an issue where it'd try to set a property of a destroyed view

// Inspired by Lauren Tan
// https://medium.com/delightful-ui-for-ember-apps/ember-js-detecting-if-a-dom-element-is-in-the-viewport-eafcc77a6f86

import Ember from 'ember';

var on = Ember.on;
var get = Ember.get;
var debounce = Ember.run.debounce;
var scheduleOnce = Ember.run.scheduleOnce;
var computed = Ember.computed;
var bind = Ember.run.bind;

/**
 * @mixin ImgManagerInViewportMixin
 * @extension ImgManagerInViewportMixin
 */
export default Ember.Mixin.create({
  /**
   * The timeout to observe scrolling
   * @property scrollTimeout
   * @type {number}
   */
  scrollTimeout: 100,

  /**
   * Set to true when it entered viewport
   * @property enteredViewport
   * @type {boolean}
   */
  enteredViewport: computed(function (key, value) {
    if (arguments.length > 1) {
      if (value) {
        this._unbindScroll();
      }
    }
    else {
      value = false;
    }
    return value;
  }),

  /**
   * Updates the `enteredViewport` property
   *
   * @method _setViewport
   * @private
   */
  _setViewport: function () {
    var rect;
    if (this.isDestroying || this.isDestroyed || this._state !== 'inDOM') {
      return;
    }
    rect = this.$()[0].getBoundingClientRect();
    this.set('enteredViewport',
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
   * Set the initial value of `enteredViewport`
   *
   * @method _setInitialViewport
   * @private
   */
  _setInitialViewport: on('didInsertElement', function () {
    if (!this.get('enteredViewport')) {
      scheduleOnce('afterRender', this, '_setViewport');
    }
  }),

  /**
   * Handles the scroll event
   *
   * @method _scrollHandler
   * @private
   */
  _scrollHandler: function () {
    if (!this.get('enteredViewport')) {
      debounce(this, '_setViewport', get(this, 'scrollTimeout'));
    }
  },

  /**
   * Starts listening for the scroll event
   *
   * @method _bindScroll
   * @private
   */
  _bindScroll: on('didInsertElement', function () {
    this._unbindScroll();
    if (!this.get('enteredViewport')) {
      this._boundScrollHandler = bind(this, '_scrollHandler');
      Ember.$(document).on('touchmove', this._boundScrollHandler);
      Ember.$(window).on('scroll', this._boundScrollHandler);
    }
  }),

  /**
   * Stops listening for the scroll event
   *
   * @method _bindScroll
   * @private
   */
  _unbindScroll: on('willDestroyElement', function () {
    if (this._boundScrollHandler) {
      Ember.$(window).off('scroll', this._boundScrollHandler);
      Ember.$(document).off('touchmove', this._boundScrollHandler);
      this._boundScrollHandler = null;
    }
  })
});
