/*
 * https://github.com/Automattic/expect.js
 */

describe('bit_wrapper player event callback tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');
  jest.dontMock('../../utils/mock_vtc.js');
  jest.dontMock('../../utils/mock_bitplayer.js');
  require('../../utils/mock_vtc.js');
  require('../../utils/mock_bitplayer.js');

  // set up mock environment
  window.runningUnitTests = true;

  bitdash = function(domId) {
    return player; // this will set wrapper's player to our mock object
  }

  // Setup
  var pluginFactory, parentElement, wrapper, element, vtc;
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };
  OO.log = function() {}

  // Load file under test
  jest.dontMock('../../../src/bit/js/bit_wrapper');
  require('../../../src/bit/js/bit_wrapper');

  beforeEach(function() {
    vtc = new mock_vtc();
    player = new mock_bitplayer();
    parentElement = $("<div>");
    wrapper = pluginFactory.create(parentElement, "test", vtc.interface, {});
    element = parentElement.children()[0];
    player.ready = true;
  });

  afterEach(function() {
    if (wrapper) { wrapper.destroy(); }
  });

  // tests

  it('vtc should fire CAN_PLAY event on player\'s \'onReady\' event callback', function(){
    vtc.interface.EVENTS.CAN_PLAY = "canPlay";
    wrapper.setVideoUrl("url");
    player.conf.events.onReady({type: "onReady"});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.CAN_PLAY);
  });

  it('vtc should fire PLAY and PLAYING events on player\'s \'onPlay\' event callback', function(){
    vtc.interface.EVENTS.PLAY = "play";
    vtc.interface.EVENTS.PLAYING = "playing";
    wrapper.setVideoUrl("url");
    player.conf.events.onPlay({type: "onPlay"});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.PLAY);
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.PLAYING);
  });

  it('vtc should fire PAUSE event on player\'s \'onPause\' event callback', function(){
    vtc.interface.EVENTS.PAUSED = "paused";
    wrapper.setVideoUrl("url");
    player.conf.events.onPause({type: "onPause"});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.PAUSED);
  });

  it('vtc should fire SEEKING event on player\'s \'onSeek\' event callback', function(){
    vtc.interface.EVENTS.SEEKING = "seeking";
    expect(wrapper.isSeeking).to.be(false);
    wrapper.setVideoUrl("url");
    player.conf.events.onSeek({type: "onSeek"});
    expect(wrapper.isSeeking).to.be(true);
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.SEEKING);
  });

  it('vtc should fire VOLUME_CHANGE event on player\'s \'onVolumeChange\' event callback', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumechange";
    wrapper.setVideoUrl("url");
    player.conf.events.onVolumeChange({type: "onVolumeChange", volumeTarget: 10});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.VOLUME_CHANGE);
    expect(vtc.notifyParameters[1]).to.eql({volume: 0.1});
  });

  it('vtc should fire VOLUME_CHANGE event and volume value being set to zero on player\'s \'onMute\' event callback', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumechange";
    wrapper.setVideoUrl("url");
    player.conf.events.onMute({type: "onMute"});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.VOLUME_CHANGE);
    expect(vtc.notifyParameters[1]).to.eql({volume: 0});
  });

  it('vtc should fire VOLUME_CHANGE event and volume value being set to previously set value on player\'s \'onUnmute\' event callback', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumeChange";
    player.setVolume(75);
    wrapper.setVideoUrl("url");
    player.conf.events.onMute({type: "onMute"});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.VOLUME_CHANGE);
    expect(vtc.notifyParameters[1]).to.eql({volume: 0});
    player.conf.events.onUnmute({type: "onUnmute"});
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.VOLUME_CHANGE);
    expect(vtc.notifyParameters[1]).to.eql({volume: 0.75 });
  });

  it('vtc should fire FULLSCREEN_CHANGED event with \'isFullScreen\' parameter set to true and \'paused\' parameter reflecting whether player is paused on player\'s \'onFullscreenEnter\' event callback', function(){
    vtc.interface.EVENTS.FULLSCREEN_CHANGED = "fullScreenChanged";

    wrapper.setVideoUrl("url");
    wrapper.pause();
    player.conf.events.onFullscreenEnter({type: "onFullscreenEnter"});
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      {
        "isFullScreen": true,
        "paused": true
      }]);

    wrapper.play();
    player.conf.events.onFullscreenEnter({type: "onFullscreenEnter"});
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      {
        "isFullScreen": true,
        "paused": false
      }]);
  });

  it('vtc should fire FULLSCREEN_CHANGED event with \'isFullScreen\' parameter set to false and \'paused\' parameter reflecting whether player is paused on player\'s \'onFullscreenExit\' event callback', function(){
    vtc.interface.EVENTS.FULLSCREEN_CHANGED = "fullScreenChanged";

    wrapper.setVideoUrl("url");
    wrapper.pause();
    player.conf.events.onFullscreenExit({type: "onFullscreenExit"});
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      {
        "isFullScreen": false,
        "paused": true
      }]);

    wrapper.play();
    player.conf.events.onFullscreenExit({type: "onFullscreenExit"});
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      {
        "isFullScreen": false,
        "paused": false
      }]);
  });

  it('vtc should fire BUFFERING event on player\'s \'onStartBuffering\' event callback', function(){
    vtc.interface.EVENTS.BUFFERING = "buffering";

    wrapper.setVideoUrl("url");
    player.conf.events.onStartBuffering({type: "onStartBuffering"});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.BUFFERING);
  });

  it('vtc should fire SEEKED and BUFFERING events on player\'s \'onStartBuffering\' event callback if player was previously seeking', function(){
    vtc.interface.EVENTS.SEEKING = "seeking";
    vtc.interface.EVENTS.SEEKED = "seeked";
    vtc.interface.EVENTS.BUFFERING = "buffering";

    wrapper.setVideoUrl("url");
    player.conf.events.onSeek({type: "onSeek"});
    player.conf.events.onStartBuffering({type: "onStartBuffering"});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.SEEKING);
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.SEEKED);
    expect(vtc.notified[2]).to.eql(vtc.interface.EVENTS.BUFFERING);
  });

  it('vtc should fire BUFFERED event on player\'s \'onStopBuffering\' event callback', function(){
    vtc.interface.EVENTS.BUFFERED = "buffered";

    wrapper.setVideoUrl("url");
    player.conf.events.onStopBuffering({type: "onStopBuffering"});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.BUFFERED);
  });

  it('vtc should fire TIME_UPDATE event on player\'s \'onTimeChanged\' event callback', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeupdate";

    player.currentTime = 10;
    player.duration = 300;
    wrapper.setVideoUrl("url");
    player.conf.events.onTimeChanged({type: "onTimeChanged"});
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE,
      { currentTime: 10,
        duration: 300,
        buffer: 110,
        seekRange: { start: 0, end: 300 }
      }]);
  });

  // TODO: Add tests for platform parsing when test framework supports
});
