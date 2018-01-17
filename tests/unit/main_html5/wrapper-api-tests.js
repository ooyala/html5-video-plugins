/*
 * https://github.com/Automattic/expect.js
 */

describe('main_html5 wrapper tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');
  jest.dontMock('../../utils/mock_vtc.js');
  require('../../utils/mock_vtc.js');

  var pluginFactory, parentElement, wrapper, element, vtc, originalTimeout;

  // Setup
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  OO.CONSTANTS = {
    CLOSED_CAPTIONS: {
      SHOWING: "showing",
      HIDDEN: "hidden",
      DISABLED: "disabled"
    },
    SEEK_TO_END_LIMIT: 3
  };

  var TRACK_CLASS = "track_cc";
  var closedCaptions = {
    locale: { en: "English" },
    closed_captions_vtt: {
      en: {
        name: "English",
        url: "http://ooyala.com"
      }
    }
  };
  var params = {
    mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN
  };
  var language = "en";

  // Load file under test
  jest.dontMock('../../../src/main/js/main_html5');
  require('../../../src/main/js/main_html5');

  if (!OO.log) {
    OO.log = function() {};
  }

  beforeEach(function() {
    vtc = new mock_vtc();
    parentElement = $("<div>");
    wrapper = pluginFactory.create(parentElement, "test", vtc.interface, {});
    element = parentElement.children()[0];
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
  });

  afterEach(function() {
    OO.isEdge = false;
    OO.isAndroid = false;
    OO.isIos = false;
    OO.isIE = false;
    OO.isIE11Plus = false;
    OO.isSafari = false;
    OO.isChrome = false;
    OO.isFirefox = false;
    OO.iosMajorVersion = void 0;
    OO.macOsSafariVersion = void 0;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    if (wrapper) { wrapper.destroy(); }
  });

  // helper functions
  var setFullSeekRange = function(duration) {
    element.duration = duration;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(duration);
    element.seekable.length = 1;
  };

  var setDvr = function(start, end) {
    start = start || 0;
    end = end || 1750;

    // This can be called multiple times in order to update the DVR window,
    // we need to remove the spies before setting new values.
    if (element.__dvrSpy) {
      element.__dvrSpy.restore();
    }

    var startSpy = spyOn(element.seekable, "start").andReturn(start);
    var endSpy = spyOn(element.seekable, "end").andReturn(end);
    element.seekable.length = 1;
    element.duration = Infinity;

    // If we've set up DVR before we don't set video url again in order to
    // avoid resetting stream
    if (!element.__dvrSpy) {
      wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    }

    element.__dvrSpy = {
      restore: function() {
        element.seekable.start = startSpy.originalValue;
        element.seekable.end = endSpy.originalValue;
      }
    };
  };

  // tests

  it('should set disableNativeSeek to false by default', function(){
    expect(wrapper.disableNativeSeek).to.be(false);
  });

  it('should set the video url and return true', function(){
    var returns = wrapper.setVideoUrl("url");
    expect(returns).to.be(true);
    expect(element.src).to.eql("url");
  });

  it('should not reset the same url', function(){
    wrapper.setVideoUrl("url");
    var returns = wrapper.setVideoUrl("url");
    expect(returns).to.be(false);
  });

  it('should clear closed captions when setting a new url', function(){
    wrapper.setVideoUrl("url");
    wrapper.setClosedCaptions(language, closedCaptions, params);
    // Make sure tracks are actually there before we remove them
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
    wrapper.setVideoUrl("new_url");
    expect(element.children.length).to.be(0);
  });

  it('should not clear closed captions when setting the same url', function(){
    wrapper.setVideoUrl("url");
    wrapper.setClosedCaptions(language, closedCaptions, params);
    wrapper.setVideoUrl("url");
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
  });

  it('should restore preload attribute when setting a new url', function(){
    var originalPreloadValue = element.getAttribute("preload");
    wrapper.setVideoUrl("url1");
    wrapper.load(false);
    wrapper.setVideoUrl("url2");
    expect(element.getAttribute("preload")).to.equal(originalPreloadValue);
  });

  it('should ignore cache buster', function(){
    wrapper.setVideoUrl("url?_=1");
    var returns = wrapper.setVideoUrl("url");
    expect(returns).to.be(false);
    wrapper.setVideoUrl("url?extra=2&_=1");
    var returns = wrapper.setVideoUrl("url?extra=2");
    expect(returns).to.be(false);
    wrapper.setVideoUrl("url?_=1&extra=2");
    var returns = wrapper.setVideoUrl("url?extra=2");
    expect(returns).to.be(true); // this is a bug
    wrapper.setVideoUrl("url?_=1&extra=2");
    var returns = wrapper.setVideoUrl("url");
    expect(returns).to.be(true);
  });

  it('should remove src on empty string', function(){
    wrapper.setVideoUrl("url");
    var returns = wrapper.setVideoUrl("", "");
    expect(returns).to.be(true);
    expect(element.getAttribute("src")).to.eql(null);
  });

  it('should call stream load', function(){
    spyOn(element, "load");
    spyOn(element, "pause");
    expect(element.load.wasCalled).to.be(false);
    wrapper.load(false);
    expect(element.load.wasCalled).to.be(true);
    expect(element.pause.wasCalled).to.be(false);
  });

  it('should not call load on loaded stream when not rewinding', function(){
    spyOn(element, "load");
    expect(element.load.callCount).to.eql(0);
    wrapper.load(false);
    expect(element.load.callCount).to.eql(1);
    wrapper.load(false);
    expect(element.load.callCount).to.eql(1);
  });

  it('should not call load when already loaded and not rewinding', function(){
    spyOn(element, "load");
    $(element).triggerHandler("loadedmetadata");
    expect(element.load.wasCalled).to.be(false);
    wrapper.load(false);
    expect(element.load.wasCalled).to.be(false);
  });

  it('should call load when already loaded if rewinding', function(){
    spyOn(element, "load");
    $(element).triggerHandler("loadedmetadata");
    expect(element.load.wasCalled).to.be(false);
    wrapper.load(true);
    expect(element.load.wasCalled).to.be(true);
  });

  it('should call pause stream when rewinding', function(){
    spyOn(element, "pause");
    expect(element.pause.callCount).to.eql(0);
    wrapper.load(true);
    expect(element.pause.callCount).to.eql(1);
  });

  /*
  // TODO: Implement testing for setting of currentTime once async loading a stream is working
  // does it have to be in the document to load a stream?
  // Perhaps try the old jasmine api "waitsFor"
  it('should set currentTime to 0 when rewinding', function(done){
    element.addEventListener("error", function(){
      console.log("error");
      expect(false).to.be(true);
      done();
    });
    element.addEventListener("loadstart", function(){
      console.log("loadstart");
      expect(element.currentTime).to.eql(0);
      done();
    });
    element.src = "http://cdn.liverail.com/adasset4/1331/229/331/lo.mp4";
    wrapper.load(true);
  });
  */

  it('should call load on loaded stream when rewinding', function(){
    element.src = "url";
    spyOn(element, "load");
    expect(element.load.callCount).to.eql(0);
    wrapper.load(false);
    expect(element.load.callCount).to.eql(1);
    wrapper.load(true);
    expect(element.load.callCount).to.eql(2);
  });

  it('should not set currentTime or pause on Edge when loading with rewinding', function(){
    OO.isEdge = true;
    spyOn(element, "pause");
    spyOn(element, "load");
    element.currentTime = 10;
    expect(element.pause.callCount).to.eql(0);
    expect(element.load.callCount).to.eql(0);
    wrapper.load(true);
    expect(element.pause.callCount).to.eql(0);
    expect(element.load.callCount).to.eql(1);
    expect(element.currentTime).to.eql(10);
  });

  it('should set preload to auto when loading', function(){
    element.src = "url";
    wrapper.load(false);
    expect(element.getAttribute("preload")).to.equal("auto");
  });

  it('should act on initialTime if has not played', function(){
    spyOn(wrapper, "seek");
    wrapper.setInitialTime(10);
    expect(wrapper.seek.wasCalled).to.be(true);
  });

  it('should not act on initialTime if initial time is 0', function(){
    spyOn(wrapper, "seek");
    wrapper.setInitialTime(0);
    expect(wrapper.seek.wasCalled).to.be(false);
  });

  it('should delay initialTime on Android until timeupdate is called', function(){
    OO.isAndroid = true;
    spyOn(wrapper, "seek");
    wrapper.setInitialTime(10);
    expect(wrapper.seek.wasCalled).to.be(false);
    $(element).triggerHandler("timeupdate");
    expect(wrapper.seek.wasCalled).to.be(true);
  });

  it('should play if not seeking', function(){
    spyOn(element, "play");
    wrapper.play();
    expect(element.play.wasCalled).to.be(true);
  });

  it('should not load on play if loaded', function(){
    wrapper.load();
    spyOn(element, "load");
    wrapper.play();
    expect(element.load.wasCalled).to.be(false);
  });

  it('should load on play if not loaded', function(){
    spyOn(element, "load");
    wrapper.play();
    expect(element.load.wasCalled).to.be(true);
  });

  it('should not play if seeking', function(){
    element.seeking = true;
    spyOn(element, "play");
    wrapper.play();
    expect(element.play.wasCalled).to.be(false);
  });

  it('should not act on initialTime if has played', function(){
    spyOn(wrapper, "seek");
    wrapper.play();
    wrapper.setInitialTime(10);
    expect(wrapper.seek.wasCalled).to.be(false);
  });

  it('should act on initialTime if has played and video ended', function(){
    spyOn(wrapper, "seek");
    wrapper.play();
    $(element).triggerHandler("ended");
    wrapper.setInitialTime(10);
    expect(wrapper.seek.wasCalled).to.be(true);
  });

  it('should call pause on element when wrapper paused', function(){
    spyOn(wrapper, "pause");
    wrapper.pause();
    expect(wrapper.pause.wasCalled).to.be(true);
  });

  it('should ignore seek if seekrange is 0', function(){
    element.duration = 10;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(0);
    element.seekable.length = 0;
    var returns = wrapper.seek(0);
    expect(returns).to.be(false);
    var returns = wrapper.seek(1);
    expect(returns).to.be(false);
  });

  it('should ignore seek for live streams with no DVR', function(){
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(0);
    wrapper.setVideoUrl("url", "mp4", true);
    element.duration = Infinity;
    var returns = wrapper.seek(1);
    expect(returns).to.be(false);
  });

  it('should NOT ignore seek for VOD stream even if duration of video is zero or Infinity or NaN', function(){
    wrapper.setVideoUrl("url", "mp4", false);
    element.duration = 0;
    setFullSeekRange(10);
    var returns = wrapper.seek(1);
    expect(returns).to.be(true);
    element.duration = Infinity;
    returns = wrapper.seek(1);
    expect(returns).to.be(true);
    element.duration = "abcde";
    returns = wrapper.seek(1);
    expect(returns).to.be(true);
  });

  it('should enqueue seeking if seekvalue invalid', function(){
    var duration = 10;
    setFullSeekRange(duration);
    var returns = wrapper.seek(true);
    expect(returns).to.be(false);
    var returns = wrapper.seek("hi");
    expect(returns).to.be(false);
  });

  it('should convert seek times outside of range into in-range', function(){
    var duration = 10;
    setFullSeekRange(duration);
    var returns = wrapper.seek(element.seekable.start(0) - 1);
    expect(returns).to.be(true);
    expect(element.currentTime).to.eql(null);
    var returns = wrapper.seek(element.seekable.end(0) + 1);
    expect(returns).to.be(true);
    expect(element.currentTime).to.eql(duration - 0.01);
  });

  it('should force seeks within SEEK_TO_END_LIMIT to seek to duration - 0.01', function(){
    var duration = 10;
    setFullSeekRange(duration);
    var returns = wrapper.seek(duration - 3);
    expect(returns).to.be(true);
    expect(element.currentTime).to.eql(duration - 0.01);
    var returns = wrapper.seek(duration - 2.99);
    expect(returns).to.be(true);
    expect(element.currentTime).to.eql(duration - 0.01);
    var returns = wrapper.seek(duration - 1);
    expect(returns).to.be(true);
    expect(element.currentTime).to.eql(duration - 0.01);
  });

  it('should block seekable from seeks until video initialization in safari', function(){
    OO.isSafari = true;
    vtc.interface.EVENTS.DURATION_CHANGE = "durationchange";
    element.currentTime = 3;
    element.duration = 10;
    spyOn(element.seekable, "start").andReturn(2);
    spyOn(element.seekable, "end").andReturn(10);
    element.seekable.length = 1;

    wrapper.seek(8);
    expect(element.seekable.start.wasCalled).to.be(false);
    expect(element.seekable.end.wasCalled).to.be(false);

    $(element).triggerHandler("canplay");
    wrapper.seek(8);
    expect(element.seekable.start.wasCalled).to.be(true);
    expect(element.seekable.end.wasCalled).to.be(true);
  });

  it('should reblock seekable from seeks upon load until video initialization in safari', function(){
    OO.isSafari = true;
    vtc.interface.EVENTS.DURATION_CHANGE = "durationchange";
    element.currentTime = 3;
    element.duration = 10;
    element.seekable.length = 1;

    spyOn(element.seekable, "start").andReturn(2);
    spyOn(element.seekable, "end").andReturn(10);
    $(element).triggerHandler("canplay");
    wrapper.seek(8);
    expect(element.seekable.start.wasCalled).to.be(true);
    expect(element.seekable.end.wasCalled).to.be(true);

    element.seekable.start.reset();
    element.seekable.end.reset();
    wrapper.load();
    wrapper.seek(8);
    expect(element.seekable.start.wasCalled).to.be(false);
    expect(element.seekable.end.wasCalled).to.be(false);
  });

  it('DVR: should NOT ignore seek for live streams with DVR enabled', function() {
    setDvr();
    expect(wrapper.seek(1)).to.be(true);
  });

  it('DVR: should NOT update currentTime when seek() is called with invalid value', function() {
    setDvr();
    element.currentTime = 1000;
    wrapper.seek(-1);
    // JSDOM returns currentTime as string, browsers don't
    expect(Number(element.currentTime)).to.be(1000);
    wrapper.seek(-10);
    expect(Number(element.currentTime)).to.be(1000);
    wrapper.seek('w00t');
    expect(Number(element.currentTime)).to.be(1000);
    wrapper.seek();
    expect(Number(element.currentTime)).to.be(1000);
    wrapper.seek(null);
    expect(Number(element.currentTime)).to.be(1000);
    wrapper.seek({});
    expect(Number(element.currentTime)).to.be(1000);
    wrapper.seek([]);
    expect(Number(element.currentTime)).to.be(1000);
  });

  it('DVR: should constrain seek time to DVR window', function() {
    var dvrWindowStart = 500;
    var dvrWindowSize = 1750;
    var dvrWindowEnd = dvrWindowStart + dvrWindowSize;
    setDvr(dvrWindowStart, dvrWindowEnd);
    element.currentTime = 1000;
    wrapper.seek(dvrWindowSize);
    // JSDOM returns currentTime as string, browsers don't
    expect(Number(element.currentTime)).to.be(dvrWindowEnd);
    wrapper.seek(0);
    expect(Number(element.currentTime)).to.be(dvrWindowStart);
    wrapper.seek(dvrWindowSize + 100);
    expect(Number(element.currentTime)).to.be(dvrWindowEnd);
  });

  it('DVR: should calculate DVR seek time relative to DVR start and end values', function() {
    var dvrWindowStart = 2000;
    var dvrWindowSize = 2000;
    var dvrWindowEnd = dvrWindowStart + dvrWindowSize;
    setDvr(dvrWindowStart, dvrWindowEnd);
    element.currentTime = 3900;
    wrapper.seek(dvrWindowSize / 2);
    // JSDOM returns currentTime as string, browsers don't
    expect(Number(element.currentTime)).to.be(dvrWindowStart + (dvrWindowSize / 2));
    wrapper.seek(dvrWindowSize);
    expect(Number(element.currentTime)).to.be(dvrWindowEnd);
  });

  it('DVR: should update time shift when seeking', function() {
    var params;
    var dvrWindowStart = 100;
    var dvrWindowSize = 1600;
    var dvrWindowEnd = dvrWindowStart + dvrWindowSize;
    setDvr(dvrWindowStart, dvrWindowEnd);
    element.currentTime = dvrWindowSize;
    // currentTime without shift should equal DVR window size
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize);
    // Seek to the middle of the stream
    wrapper.seek(dvrWindowSize / 2);
    $(element).triggerHandler("seeked");
    // Time shift should be reflected in the value of currentTime
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize / 2);
  });

  it('DVR: should update time shift after natively triggered SEEKED events', function() {
    var params;
    var dvrWindowSize = 1750;
    setDvr(0, dvrWindowSize);
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize);
    // Trigger seeked without calling wrapper.seek() in order to simulate native controls
    element.currentTime = 875;
    $(element).triggerHandler("seeked");
    // Time shift should be reflected in the value of currentTime
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(875);
  });

  it('DVR: should NOT update time shift after SEEKED events when seeking with wrapper.seek()', function() {
    var params;
    var dvrWindowSize = 1750;
    setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize);
    // Time shift is updated when calling seek, but shouldn't be updated again when seeked is fired
    wrapper.seek(dvrWindowSize / 2);
    // Simulating that DVR window changes while we were seeking, which would result in a different shift value
    setDvr(100, dvrWindowSize + 100);
    $(element).triggerHandler("seeked");
    // Current time should reflect shift calculated on wrapper.seeked() and shouldn't be updated after seeked event
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize / 2);
  });

  it('DVR: should adapt to changes in the DVR window', function() {
    var params;
    var dvrWindowSize = 1750;
    var midpoint = dvrWindowSize / 2;
    setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    // Test seek with initial DVR window
    wrapper.seek(midpoint);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(midpoint);
    expect(Number(params.currentLiveTime)).to.be(midpoint);
    // Move DVR window forward
    setDvr(100, dvrWindowSize + 100);
    // Test seek with updated DVR window
    wrapper.seek(midpoint);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(midpoint);
    expect(Number(params.currentLiveTime)).to.be(midpoint + 100);
  });

  it('DVR: should update time shift when resuming after a pause', function() {
    var params;
    var dvrWindowSize = 1800;
    setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    // Initial play
    wrapper.play();
    $(element).triggerHandler("playing");
    // Check initial time shift
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize);
    // Pause
    wrapper.pause();
    $(element).triggerHandler("pause");
    // Move DVR window forward during pause
    setDvr(100, dvrWindowSize + 100);
    element.currentTime = dvrWindowSize;
    // Resume playback
    wrapper.play();
    $(element).triggerHandler("playing");
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    // Time shift should reflect that we're falling behind the live playhead
    expect(params.currentTime).to.be(dvrWindowSize - 100);
  });

  it('DVR: should NOT update time shift on initial play', function() {
    var params;
    var dvrWindowSize = 1800;
    setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    // Move DVR window forward before playing
    setDvr(100, dvrWindowSize + 100);
    element.currentTime = dvrWindowSize;
    // Initial play
    wrapper.play();
    $(element).triggerHandler("playing");
    // Time shift should not be affected by playing event
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize);
  });

  it('DVR: should NOT update time shift after PLAYING event if video was not paused', function() {
    var params;
    var dvrWindowSize = 1800;
    var midpoint = dvrWindowSize / 2;
    setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    // Play and seek to midpoint
    wrapper.play();
    $(element).triggerHandler("playing");
    wrapper.seek(midpoint);
    $(element).triggerHandler("seeked");
    // Check time shift after seek
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(midpoint);
    // Update DVR window before firing playing
    setDvr(100, dvrWindowSize + 100);
    element.currentTime = dvrWindowSize;
    // Fire playing as some browsers do right after a seeked event
    $(element).triggerHandler("playing");
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    // Time shift should not change after playing event
    expect(params.currentTime).to.be(midpoint);
  });

  it('DVR: time shift should not exceed max time shift value', function() {
    var params;
    var dvrWindowSize = 1750;
    setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    // Initial play
    wrapper.play();
    $(element).triggerHandler("playing");
    // Pause
    wrapper.pause();
    $(element).triggerHandler("pause");
    // Move DVR window way past window size, but keep current time the same
    setDvr(5000, dvrWindowSize + 5000);
    element.currentTime = dvrWindowSize;
    // Resume playback in order to update time shift
    wrapper.play();
    $(element).triggerHandler("playing");
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    // Current time would shift to a negative value if check wasn't working
    expect(params.currentTime).to.be(0);
  });

  it('should set volume if between 0 and 1', function(){
    wrapper.setVolume(0.1);
    expect(element.volume).to.eql(0.1);
    wrapper.setVolume(0);
    expect(element.volume).to.eql(0);
    wrapper.setVolume(1);
    expect(element.volume).to.eql(1);
  });

  it('should set volume to 1 if told to set above 1', function(){
    wrapper.setVolume(1.1);
    expect(element.volume).to.eql(1);
    wrapper.setVolume(2);
    expect(element.volume).to.eql(1);
  });

  it('should set volume to 0 if told to set below 0', function(){
    wrapper.setVolume(-0.1);
    expect(element.volume).to.eql(0);
    wrapper.setVolume(-2);
    expect(element.volume).to.eql(0);
  });

  it('should not unmute if setVolume is called with a value above 0', function(){
    element.muted = true;
    wrapper.setVolume(0.5);
    expect(element.volume).to.eql(0.5);
    expect(element.muted).to.eql(true);
  });

  it('should not unmute if setVolume is called with a value of 0', function(){
    element.muted = true;
    wrapper.setVolume(0);
    expect(element.volume).to.eql(0);
    expect(element.muted).to.eql(true);
  });

  it('should restore last known volume set when unmuting', function(){
    wrapper.setVolume(1);
    expect(element.volume).to.eql(1);
    //external change
    element.volume = 0;
    expect(element.volume).to.eql(0);
    wrapper.unmute();
    expect(element.volume).to.eql(1);
  });

  it('should mute video element and send out mute_state_change event when mute is called', function(){
    vtc.notifyParametersHistory = [];
    wrapper.mute();
    expect(element.muted).to.eql(true);
    expect(vtc.notifyParametersHistory[1]).to.eql([vtc.interface.EVENTS.MUTE_STATE_CHANGE, { muted: true }]);
  });

  it('should unmute video element and send out mute_state_change event when unmute is called', function(){
    vtc.notifyParametersHistory = [];
    element.muted = true;
    wrapper.unmute();
    expect(element.muted).to.eql(false);
    //sent when element.muted is set to true in this unit test 3 lines aboe
    expect(vtc.notifyParametersHistory[1]).to.eql([vtc.interface.EVENTS.MUTE_STATE_CHANGE, { muted: true }]);
    //sent when the unmute() api is called
    expect(vtc.notifyParametersHistory[3]).to.eql([vtc.interface.EVENTS.MUTE_STATE_CHANGE, { muted: false }]);
  });

  it('should notify VOLUME_CHANGE on volume change of video with empty string', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumeChange";
    element.currentSrc = "";
    vtc.notifyParametersHistory = [];
    wrapper.setVolume(0.3);
    expect(vtc.notifyParametersHistory[0]).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.3 }]);
    vtc.notifyParametersHistory = [];
    element.currentSrc = null;
    wrapper.setVolume(0.2);
    expect(vtc.notifyParametersHistory[0]).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.2 }]);
    vtc.notifyParametersHistory = [];
    element.currentSrc = "url";
    wrapper.setVolume(0.5);
    expect(vtc.notifyParametersHistory[0]).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.5 }]);
  });

  it('should notify of UNMUTED_PLAYBACK_FAILED when play promise fails with an unmuted video', function(){
    var catchCallback = null;
    var originalPlayFunction = element.play;
    element.muted = false;
    // Replace mock play function with one that returns a promise
    element.play = function() {
      return {
        then: function(callback) {
        },
        catch: function(callback) {
          catchCallback = callback;
        }
      };
    };
    vtc.notified = [];
    wrapper.play();
    catchCallback({});
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.UNMUTED_PLAYBACK_FAILED);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should handle differing play promise failures', function(){
    //Chrome is a browser that throws different errors for play promise failures
    OO.isChrome = true;
    var catchCallback = null;
    var originalPlayFunction = element.play;
    element.muted = false;
    // Replace mock play function with one that returns a promise
    element.play = function() {
      return {
        then: function(callback) {
        },
        catch: function(callback) {
          catchCallback = callback;
        }
      };
    };
    vtc.notified = [];
    wrapper.play();
    catchCallback(
      {
        name: "AbortError"
      }
    );
    expect(vtc.notified.length).to.eql(0);
    catchCallback(
      {
        name: "NotAllowedError"
      }
    );
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.UNMUTED_PLAYBACK_FAILED);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should notify of UNMUTED_PLAYBACK_SUCCEEDED when play promise is fulfilled with an unmuted video', function(){
    var thenCallback = null;
    var originalPlayFunction = element.play;
    element.muted = false;
    // Replace mock play function with one that returns a promise
    element.play = function() {
      return {
        then: function(callback) {
          thenCallback = callback;
        },
        catch: function(callback) {
        }
      };
    };
    vtc.notified = [];
    wrapper.play();
    thenCallback();
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.UNMUTED_PLAYBACK_SUCCEEDED);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should not notify of UNMUTED_PLAYBACK_SUCCEEDED when play promise is fulfilled with an muted video', function(){
    var thenCallback = null;
    var originalPlayFunction = element.play;
    element.muted = true;
    // Replace mock play function with one that returns a promise
    element.play = function() {
      return {
        then: function(callback) {
          thenCallback = callback;
        },
        catch: function(callback) {
        }
      };
    };
    vtc.notified = [];
    wrapper.play();
    thenCallback();
    expect(vtc.notified[0]).to.not.eql(vtc.interface.EVENTS.UNMUTED_PLAYBACK_SUCCEEDED);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should prime a video element with play and pause', function(){
    spyOn(element, "play");
    spyOn(element, "pause");
    wrapper.primeVideoElement();
    expect(element.play.wasCalled).to.be(true);
    expect(element.pause.wasCalled).to.be(true);
  });

  it('should wait for play promise to be resolved before pausing when priming on iOS', function(){
    OO.isIos = true;
    var thenCallback = null;
    var originalPlayFunction = element.play;
    // Replace mock play function with one that returns a promise
    element.play = function() {
      return {
        then: function(callback) {
          thenCallback = callback;
        }
      };
    };
    spyOn(element, "pause");
    wrapper.load(false);
    wrapper.primeVideoElement();
    // Pause should not be called until promise is resolved
    expect(element.pause.wasCalled).to.be(false);
    thenCallback();
    expect(element.pause.wasCalled).to.be(true);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should not pause when priming on iOS if playback has already been requested', function(){
    OO.isIos = true;
    var thenCallback = null;
    var originalPlayFunction = element.play;
    // Replace mock play function with one that returns a promise
    element.play = function() {
      return {
        then: function(callback) {
          thenCallback = callback;
        }
      };
    };
    spyOn(element, "pause");
    wrapper.load(false);
    wrapper.primeVideoElement();
    // Simulating that play() gets called before the original video.play promise from
    // the priming call is resolved
    wrapper.play();
    thenCallback();
    expect(element.pause.wasCalled).to.be(false);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should append and change css', function(){
    var css = { "visibility" : "hidden" };
    wrapper.applyCss(css);
    expect(element.getAttribute("style")).to.be.ok();
    expect(element.getAttribute("style")).to.contain("visibility");
    expect(element.getAttribute("style")).to.contain("hidden");
    var css = { "width" : "100%" };
    wrapper.applyCss(css);
    expect(element.getAttribute("style")).to.be.ok();
    expect(element.getAttribute("style")).to.contain("visibility");
    expect(element.getAttribute("style")).to.contain("hidden");
    expect(element.getAttribute("style")).to.contain("width");
    expect(element.getAttribute("style")).to.contain("100%");
    var css = { "visibility" : "visible", "height" : "100%" };
    wrapper.applyCss(css);
    expect(element.getAttribute("style")).to.be.ok();
    expect(element.getAttribute("style")).to.contain("visibility");
    expect(element.getAttribute("style")).to.contain("visible");
    expect(element.getAttribute("style")).to.contain("height");
    expect(element.getAttribute("style")).to.contain("100%");
  });

  it('should pause the video element on destroy', function(){
    spyOn(element, "pause");
    expect(element.pause.wasCalled).to.be(false);
    wrapper.destroy();
    expect(element.pause.wasCalled).to.be(true);
  });

  it('should unset the src on destroy', function(){
    element.src = "url";
    expect(element.src).to.eql("url");
    wrapper.destroy();
    expect(element.src).to.eql("");
  });

  it('should NOT unset the src on destroy for IE11', function(){
    OO.isIE = true;
    element.src = "url";
    expect(element.src).to.eql("url");
    wrapper.destroy();
    expect(element.src).to.eql("url");
  });

  it('should NOT unset the src on destroy for Edge', function(){
    OO.isEdge = true;
    element.src = "url";
    expect(element.src).to.eql("url");
    wrapper.destroy();
    expect(element.src).to.eql("url");
  });

  it('should set external closed captions', function(){
    wrapper.setClosedCaptions(language, closedCaptions, params);
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
    expect(element.children[0].getAttribute("class")).to.eql(TRACK_CLASS);
    expect(element.children[0].getAttribute("kind")).to.eql("subtitles");
    expect(element.children[0].getAttribute("label")).to.eql("English");
    expect(element.children[0].getAttribute("src")).to.eql("http://ooyala.com");
    expect(element.children[0].getAttribute("srclang")).to.eql("en");
  });

  it('should set closed captions mode for in-stream captions', function(){
    element.textTracks = [{ mode: OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED, kind: "captions" }];
    $(element).triggerHandler("playing");
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    wrapper.setClosedCaptions("CC", null, { mode: "showing" });
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
  });

  it('should replace French text tracks by English text tracks for iOS versions < 10 ', function(){
    OO.iosMajorVersion = 9;
    $(element).append("<track class='" + TRACK_CLASS + "' kind='subtitles' label='French' src='http://french.ooyala.com' srclang='fr'>");
    wrapper.setClosedCaptions(language, closedCaptions, { mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN });
    expect(element.children.length).to.eql(1);
    expect(element.children[0].tagName).to.eql("TRACK");
    expect(element.children[0].getAttribute("label")).to.eql("English");
    expect(element.children[0].getAttribute("kind")).to.eql("subtitles");
    expect(element.children[0].getAttribute("src")).to.eql("http://ooyala.com");
    expect(element.children[0].getAttribute("srclang")).to.eql("en");
  });

  it('should replace French text tracks by English text tracks for OSX/Safari versions < 10 ', function(){
    OO.macOsSafariVersion = 9;
    $(element).append("<track class='" + TRACK_CLASS + "' kind='subtitles' label='French' src='http://french.ooyala.com' srclang='fr'>");
    wrapper.setClosedCaptions(language, closedCaptions, { mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN });
    expect(element.children.length).to.eql(1);
    expect(element.children[0].tagName).to.eql("TRACK");
    expect(element.children[0].getAttribute("label")).to.eql("English");
    expect(element.children[0].getAttribute("kind")).to.eql("subtitles");
    expect(element.children[0].getAttribute("src")).to.eql("http://ooyala.com");
    expect(element.children[0].getAttribute("srclang")).to.eql("en");
  });

  it('should replace French subtitles by English ones on Safari version >= 10 and other platforms', function(){
    OO.isChrome = true;
    var closedCaptions2 = {
      locale: { fr: "French" },
      closed_captions_vtt: {
        fr: {
          name: "French",
          url: "http://french.ooyala.com"
        }
      }
    };

    wrapper.setClosedCaptions('fr', closedCaptions2, { mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN });
    wrapper.setClosedCaptions(language, closedCaptions, { mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN });
    expect(element.children.length).to.eql(1);
    expect(element.children[0].getAttribute("label")).to.eql("English");
    expect(element.children[0].getAttribute("kind")).to.eql("subtitles");
    expect(element.children[0].getAttribute("src")).to.eql("http://ooyala.com");
    expect(element.children[0].getAttribute("srclang")).to.eql("en");
  });

  it('should set both in-stream and external closed captions and switches between them', function(){
    element.textTracks = [{ kind: "captions" }, { kind: "captions" }];
    $(element).triggerHandler("playing"); // this adds in-stream captions

    wrapper.setClosedCaptionsMode(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);

    wrapper.setClosedCaptions("CC", null, {mode: OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING});
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);

    wrapper.setClosedCaptions("en", closedCaptions, {mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN}); // this adds external captions
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN);
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN);
  });

  it('should remove closed captions if language is null', function(){
    wrapper.setClosedCaptions(language, closedCaptions, params);
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
    wrapper.setClosedCaptions(null, closedCaptions, params);
    expect(element.children.length).to.eql(0);
  });

  it('should set the closed captions mode', function(){
    //Mock textTracks
    element.textTracks = [{ mode: OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED }];
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    wrapper.setClosedCaptionsMode(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
    wrapper.setClosedCaptionsMode(OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN);
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN);
  });

  it('should set the crossorigin attribute', function(){
    expect(element.getAttribute("crossorigin")).to.not.be.ok();
    wrapper.setCrossorigin("anonymous");
    expect(element.getAttribute("crossorigin")).to.eql("anonymous");
    wrapper.setCrossorigin(null);
    expect(element.getAttribute("crossorigin")).to.not.be.ok();
  });

  it('should NOT set the crossorigin attribute on iOS 11', function(){
    OO.isIos = true;
    OO.iosMajorVersion = 11;
    expect(element.getAttribute("crossorigin")).to.not.be.ok();
    wrapper.setCrossorigin("anonymous");
    expect(element.getAttribute("crossorigin")).to.not.be.ok();
    // Clearing crossorigin should still work
    element.setAttribute("crossorigin", "anonymous");
    expect(element.getAttribute("crossorigin")).to.be("anonymous");
    wrapper.setCrossorigin(null);
    expect(element.getAttribute("crossorigin")).to.not.be.ok();
  });

  it('should return current time on getCurrentTime', function(){
    element.currentTime = 10;
    expect(wrapper.getCurrentTime()).to.eql(10);
    element.currentTime = 0;
    expect(wrapper.getCurrentTime()).to.eql(null);
    element.currentTime = 1000000;
    expect(wrapper.getCurrentTime()).to.eql(1000000);
  });

  /*
  // TODO: implement unsubscription test
  it('should unsubscribe from events on destroy', function(){
    // Verify notify api is not called when event raised on element after destroy
  });
  */

  it('should remove the video element on destroy', function(){
    wrapper.destroy();
    expect($(parentElement).has(":first-child").length).to.eql(0);
  });

});
