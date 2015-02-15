import Ember from 'ember';

function hookHandler(type, id) {
  return function (img) {
    // using unshift so that the `hooked` returns the last one registered
    this.get('hooks').unshift({type: type, id: id, img: img});
  };
}

export default Ember.Controller.extend({
  imgSrc1: null,
  imgSrc2: null,
  imgSrc3: null,

  hooks: Ember.computed(function () {
    return [];
  }),

  hooked: function (type, id) {
    return this.get('hooks').find(function (hooked) {
      return (!type || hooked.type === type) && (!id || hooked.id === id);
    });
  },

  hookeds: function (type, id) {
    return this.get('hooks').filter(function (hooked) {
      return (!type || hooked.type === type) && (!id || hooked.id === id);
    });
  },

  resetHooks: function () {
    this.notifyPropertyChange('hooks');
  },

  actions: {
    didSuccess1: hookHandler('success', 1),
    didSuccess2: hookHandler('success', 2),
    didSuccess3: hookHandler('success', 3),
    didError1:   hookHandler('error', 1),
    didError2:   hookHandler('error', 2),
    didError3:   hookHandler('error', 3)
  }
});
