mock_vtc = function() {
  this.notifyParameters = null;
  this.interface = {
    EVENTS: {},
    notify: function(){
      this.notifyParameters = Array.prototype.slice.call(arguments);
    }.bind(this)
  }
};
