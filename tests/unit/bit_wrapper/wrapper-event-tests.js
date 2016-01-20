/*
 * https://github.com/Automattic/expect.js
 */

describe('bit_wrapper wrapper tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');
  jest.dontMock('../../utils/mock_vtc.js');
  require('../../utils/mock_vtc.js');

  var events = require('events');
  var eventEmitter = new events.EventEmitter();

  // set up mock environment
  window.runningUnitTests = true;

  player = (function() {
    this.duration = 0;
    this.currentTime = 0;
    this.volume = 0;
    this.isPaused = false;
    this.exists = true;
    this.trackId = "";
    this.cc_url = "";
    this.cc_language = "";
    this.cc_name = "";
    this.cc_subtitle = "";
    this.subtitles = {};
    
    this.isReady = function() {
      return true;
    };
    
    this.load = function(reload) {
    };
    
    this.pause = function() {
      this.paused = true;
    };
    
    this.isPaused = function() {
      return this.paused;
    };

    this.seek = function(time) {
      this.currentTime = time;
    };
    
    this.play = function() {
      this.paused = false;
    };

    this.getDuration = function() {
      return this.duration;
    };

    this.getVideoBufferLength = function() {
      return 100;
    }

    this.getCurrentTime = function() {
      return this.currentTime;
    };
    
    this.getVolume = function() {
      return this.volume;
    };
    
    this.setVolume = function(volume) {
      this.volume = volume * 100;
    };

    this.addSubtitle = function(url, trackId, subtitle, language, name) {
      var obj = {
        url: url,
        label: name,
        lang: language
      }
      var arr = this.subtitles.trackId || [];
      arr.push(obj);
      this.subtitles.trackId = arr;

      this.cc_url = url;
      this.cc_language = language;
      this.cc_name = name;
      this.cc_subtitle = subtitle;
    };

    this.removeSubtitle = function(trackId) {
      delete subtitles.trackId;
      this.trackId = null;
    }

    this.setSubtitle = function(trackId) {
      this.trackId = trackId;
    };

    this.getSubtitle = function() {
      if (!!trackId) {
        return this.subtitles.trackId;
      } else {
        return null;
      }
    };

    this.getAvailableSubtitles = function() {
      return this.subtitles;
    };

    this.destroy = function() { 
      this.exists = false; // to verify that destroy was called
    };

    return this;
  })();

  bitdash = function(domId) {
    return player; // this will set wrapper's player to our mock object
  }

  // Setup
  var pluginFactory, parentElement, wrapper, element, vtc;
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  // Load file under test
  jest.dontMock('../../../src/bit/js/bit_wrapper');
  require('../../../src/bit/js/bit_wrapper');

  beforeEach(function() {
    vtc = new mock_vtc();
    parentElement = $("<div>");
    wrapper = pluginFactory.create(parentElement, "test", vtc.interface, {});
    element = parentElement.children()[0];
    player.ready = true;
  });

  afterEach(function() {
    OO.isSafari = false;
    if (wrapper) { wrapper.destroy(); }
  });

  // tests

  it('vtc should fire CAN_PLAY event on player\'s \'onReady\' event callback', function(){
    vtc.interface.EVENTS.CAN_PLAY = "canPlay";
    eventEmitter.on("onReady", function(args) { wrapper.onReady(args); });
    eventEmitter.emit("onReady", {type: "onReady" });
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.CAN_PLAY);
  });

  it('vtc should fire PLAY and PLAYING events on player\'s \'onPlay\' event callback', function(){
    vtc.interface.EVENTS.PLAY = "play";
    vtc.interface.EVENTS.PLAYING = "playing";
    eventEmitter.on("onPlay", function(args) { wrapper.onPlay(args); });
    eventEmitter.emit("onPlay", {type: "onPlay" });
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.PLAY);
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.PLAYING);
  });

  it('vtc should fire PAUSE event on player\'s \'onPause\' event callback', function(){
    vtc.interface.EVENTS.PAUSED = "paused";
    eventEmitter.on("onPause", function(args) { wrapper.onPause(args); });
    eventEmitter.emit("onPause", {type: "onPause" });
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.PAUSED);
  });

  it('vtc should fire SEEKING event on player\'s \'onSeek\' event callback', function(){
    vtc.interface.EVENTS.SEEKING = "seeking";
    expect(wrapper.isSeeking).to.be(false);
    eventEmitter.on("onSeek", function(args) { wrapper.onSeek(args); });
    eventEmitter.emit("onSeek", {type: "onSeek" });
    expect(wrapper.isSeeking).to.be(true);
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.SEEKING);
  });

  it('vtc should fire VOLUME_CHANGE event on player\'s \'onVolumeChange\' event callback', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumechange";
    eventEmitter.on("onVolumeChange", function(args) { wrapper.onVolumeChange(args); });
    eventEmitter.emit("onVolumeChange", {type: "onVolumeChange", volumeTarget: 10 });
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.VOLUME_CHANGE);
    expect(vtc.notifyParameters[1]).to.eql({volume: 10});
  });

  it('vtc should fire VOLUME_CHANGE event and volume value being set to zero on player\'s \'onMute\' event callback', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumechange";
    eventEmitter.on("onMute", function(args) { wrapper.onMute(args); });
    eventEmitter.emit("onMute", {type: "onMute" });
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.VOLUME_CHANGE);
    expect(vtc.notifyParameters[1]).to.eql({volume: 0});
  });

  it('vtc should fire VOLUME_CHANGE event and volume value being set to previously set value on player\'s \'onUnmute\' event callback', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumeChange";
    player.setVolume(0.75);
    eventEmitter.on("onMute", function(args) { wrapper.onMute(args); });
    eventEmitter.on("onUnmute", function(args) { wrapper.onUnmute(args); });

    eventEmitter.emit("onMute", {type: "onMute" });
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.VOLUME_CHANGE);
    expect(vtc.notifyParameters[1]).to.eql({volume: 0});
    eventEmitter.emit("onUnmute", {type: "onUnmute" });
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.VOLUME_CHANGE);
    expect(vtc.notifyParameters[1]).to.eql({volume: 0.75 });
  });

  it('vtc should fire FULLSCREEN_CHANGED event with \'isFullScreen\' parameter set to true and \'paused\' parameter reflecting whether player is paused on player\'s \'onFullscreenEnter\' event callback', function(){
    vtc.interface.EVENTS.FULLSCREEN_CHANGED = "fullScreenChanged";

    eventEmitter.on("onFullscreenEnter", function(args) { wrapper.onFullscreenEnter(args); });

    wrapper.pause();
    eventEmitter.emit("onFullscreenEnter", {type: "onFullscreenEnter" });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      {
        "isFullScreen": true,
        "paused": true
      }]);

    wrapper.play();
    eventEmitter.emit("onFullscreenEnter", {type: "onFullscreenEnter" });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      {
        "isFullScreen": true,
        "paused": false
      }]);
  });

  it('vtc should fire FULLSCREEN_CHANGED event with \'isFullScreen\' parameter set to false and \'paused\' parameter reflecting whether player is paused on player\'s \'onFullscreenExit\' event callback', function(){
    vtc.interface.EVENTS.FULLSCREEN_CHANGED = "fullScreenChanged";

    eventEmitter.on("onFullscreenExit", function(args) { wrapper.onFullscreenExit(args); });

    wrapper.pause();
    eventEmitter.emit("onFullscreenExit", {type: "onFullscreenExit" });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      {
        "isFullScreen": false,
        "paused": true
      }]);

    wrapper.play();
    eventEmitter.emit("onFullscreenExit", {type: "onFullscreenExit" });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      {
        "isFullScreen": false,
        "paused": false
      }]);
  });

  it('vtc should fire BUFFERING event on player\'s \'onStartBuffering\' event callback', function(){
    vtc.interface.EVENTS.BUFFERING = "buffering";
    eventEmitter.on("onStartBuffering", function(args) { wrapper.onStartBuffering(args); });
    eventEmitter.emit("onStartBuffering", {type: "onStartBuffering" });
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.BUFFERING);
  });

  it('vtc should fire SEEKED and BUFFERING events on player\'s \'onStartBuffering\' event callback if player was previously seeking', function(){
    vtc.interface.EVENTS.SEEKING = "seeking";
    vtc.interface.EVENTS.SEEKED = "seeked";
    vtc.interface.EVENTS.BUFFERING = "buffering";
    wrapper.onSeek({type: "onSeek" });
    eventEmitter.on("onStartBuffering", function(args) { wrapper.onStartBuffering(args); });
    eventEmitter.emit("onStartBuffering", {type: "onStartBuffering" });
    
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.SEEKING);
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.SEEKED);
    expect(vtc.notified[2]).to.eql(vtc.interface.EVENTS.BUFFERING);
  });

  it('vtc should fire BUFFERED event on player\'s \'onStopBuffering\' event callback', function(){
    vtc.interface.EVENTS.BUFFERED = "buffered";
    eventEmitter.on("onStopBuffering", function(args) { wrapper.onStopBuffering(args); });
    eventEmitter.emit("onStopBuffering", {type: "onStopBuffering" });
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.BUFFERED);
  });

  it('vtc should fire TIME_UPDATE event on player\'s \'onTimeChanged\' event callback', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeupdate";

    player.currentTime = 10;
    player.duration = 300;
    
    eventEmitter.on("onTimeChanged", function(args) { wrapper.onTimeChanged(args); });
    eventEmitter.emit("onTimeChanged", {type: "onTimeChanged" });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE,
      { currentTime: 10,
        duration: 300,
        buffer: 110,
        seekRange: { start: 0, end: 300 }
      }]);
  });

  // TODO: Add tests for platform parsing when test framework supports
});
