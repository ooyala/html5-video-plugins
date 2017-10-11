mock_vtc = function() {
  // Test properties that indicate which events were raised by the video wrapper
  this.notifyParameters = null;
  this.notified = [];
  this.notifyParametersHistory = [];

  // The vtc interface to pass to the video wrapper
  this.interface = {
    PLUGIN_MAGIC: 'key',
    EVENTS: {},
    notify: function(){
      if (arguments.length > 0) {
        this.notifyParameters = Array.prototype.slice.call(arguments);
        this.notifyParametersHistory.push(Array.prototype.slice.call(arguments));
        this.notified.push(arguments[0]);
      }
    }.bind(this),
    markNotReady: function() {},
    markReady: function() {}
  }

  // To clear the list of events notified to the mock vtc, call with this function
  this.reset = function() {
    this.notifyParameters = null;
    this.notified = [];
    this.notifyParametersHistory = [];
  }
};
