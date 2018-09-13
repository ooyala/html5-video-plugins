/*
 * https://github.com/Automattic/expect.js
 */
import TextTrackHelper from '../../../src/main/js/text_track/text_track_helper'

const sinon = require('sinon');

describe('main_html5 wrapper tests', function () {
  var pluginFactory, parentElement, wrapper, element, vtc, originalTimeout;

  // Setup
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

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
  var audioTracks = [
    {id: "0", kind: "main", label: "eng", language: "eng", enabled: true},
    {id: "1", kind: "main", label: "ger", language: "ger", enabled: false}
  ];

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
    element.textTracks = [];
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
  });

  afterEach(function() {
    OO.isEdge = false;
    OO.isAndroid = false;
    OO.isIos = false;
    OO.isIpad = false;
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
  var stubSeekable = function(element, start, end) {
    var startSpy = sinon.stub(element.seekable, "start").callsFake(() => {return start});
    var endSpy = sinon.stub(element.seekable, "end").callsFake(() => {return end});
    element.seekable.length = 1;
    return {startSpy, endSpy};
  };

  var setFullSeekRange = function(duration) {
    element.duration = duration;
    sinon.stub(element.seekable, "start").callsFake(() => {return 0});
    sinon.stub(element.seekable, "end").callsFake(() => {return duration});
    element.seekable.length = 1;
  };

  var setDvr = function(start, end) {
    start = start || 0;
    end = end || 1750;

    var startSpy = sinon.stub(element.seekable, "start").callsFake(() => {return start});
    var endSpy = sinon.stub(element.seekable, "end").callsFake(() => {return end});
    element.seekable.length = 1;
    element.duration = Infinity;

    return {startSpy, endSpy};
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
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions(language, closedCaptions, params);
    // Make sure tracks are actually there before we remove them
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
    wrapper.setVideoUrl("new_url");
    expect(element.children.length).to.be(0);
  });

  it('should not clear closed captions when setting the same url', function(){
    wrapper.setVideoUrl("url");
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions(language, closedCaptions, params);
    wrapper.setVideoUrl("url");
    $(element).triggerHandler("loadedmetadata");
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
    returns = wrapper.setVideoUrl("url?extra=2");
    expect(returns).to.be(false);
    wrapper.setVideoUrl("url?_=1&extra=2");
    returns = wrapper.setVideoUrl("url?extra=2");
    expect(returns).to.be(true); // this is a bug
    wrapper.setVideoUrl("url?_=1&extra=2");
    returns = wrapper.setVideoUrl("url");
    expect(returns).to.be(true);
  });

  it('should null out src on empty string', function(){
    wrapper.setVideoUrl("url");
    var returns = wrapper.setVideoUrl("", "");
    expect(returns).to.be(true);
    expect(element.getAttribute("src")).to.eql(null);
  });

  it('should remove src on empty string on iOS', function(){
    OO.isIos = true;
    wrapper.setVideoUrl("url");
    var returns = wrapper.setVideoUrl("", "");
    expect(returns).to.be(true);
    expect(typeof element.src).to.eql("undefined");
  });

  it('should call stream load', function(){
    var loadSpy = sinon.spy(element, "load");
    var pauseSpy = sinon.spy(element, "pause");
    expect(loadSpy.callCount).to.be(0);
    wrapper.load(false);
    expect(loadSpy.callCount).to.be(1);
    expect(pauseSpy.callCount).to.be(0);
  });

  it('should not call load on loaded stream when not rewinding', function(){
    var spy = sinon.spy(element, "load");
    expect(spy.callCount).to.eql(0);
    wrapper.load(false);
    expect(spy.callCount).to.eql(1);
    wrapper.load(false);
    expect(spy.callCount).to.eql(1);
  });

  it('should not call load when already loaded and not rewinding', function(){
    var spy = sinon.spy(element, "load");
    $(element).triggerHandler("loadedmetadata");
    expect(spy.callCount).to.be(0);
    wrapper.load(false);
    expect(spy.callCount).to.be(0);
  });

  it('should call load when already loaded if rewinding', function(){
    var spy = sinon.spy(element, "load");
    $(element).triggerHandler("loadedmetadata");
    expect(spy.callCount).to.be(0);
    wrapper.load(true);
    expect(spy.callCount).to.be(1);
  });

  it('should call pause stream when rewinding', function(){
    var spy = sinon.spy(element, "pause");
    expect(spy.callCount).to.eql(0);
    wrapper.load(true);
    expect(spy.callCount).to.eql(1);
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
    var spy = sinon.spy(element, "load");
    expect(spy.callCount).to.eql(0);
    wrapper.load(false);
    expect(spy.callCount).to.eql(1);
    wrapper.load(true);
    expect(spy.callCount).to.eql(2);
  });

  it('should not set currentTime or pause on Edge when loading with rewinding', function(){
    OO.isEdge = true;
    var pauseSpy = sinon.spy(element, "pause");
    var loadSpy = sinon.spy(element, "load");
    element.currentTime = 10;
    expect(pauseSpy.callCount).to.eql(0);
    expect(loadSpy.callCount).to.eql(0);
    wrapper.load(true);
    expect(pauseSpy.callCount).to.eql(0);
    expect(loadSpy.callCount).to.eql(1);
    expect(element.currentTime).to.eql(10);
  });

  it('should set preload to auto when loading', function(){
    element.src = "url";
    wrapper.load(false);
    expect(element.getAttribute("preload")).to.equal("auto");
  });

  it('should act on initialTime if has not played', function(){
    var spy = sinon.spy(wrapper, "seek");
    wrapper.setInitialTime(10);
    expect(spy.callCount).to.be(1);
  });

  it('should not act on initialTime if initial time is 0 if content has not started', function(){
    var spy = sinon.spy(wrapper, "seek");
    wrapper.setInitialTime(0);
    expect(spy.callCount).to.be(0);
  });

  it('should act on initialTime if initial time is 0 if content has started', function(){
    var spy = sinon.spy(wrapper, "seek");
    wrapper.play();
    $(element).triggerHandler("playing");
    wrapper.setInitialTime(0);
    expect(spy.callCount).to.be(1);
  });

  it('should not act on initialTime if initial time is null', function(){
    var spy = sinon.spy(wrapper, "seek");
    wrapper.setInitialTime(null);
    expect(spy.callCount).to.be(0);
  });

  it('should not act on initialTime if initial time is undefined', function(){
    var spy = sinon.spy(wrapper, "seek");
    wrapper.setInitialTime();
    expect(spy.callCount).to.be(0);
  });

  it('should not act on initialTime if initial time is a string', function(){
    var spy = sinon.spy(wrapper, "seek");
    wrapper.setInitialTime("string");
    expect(spy.callCount).to.be(0);
  });

  it('should delay initialTime on Android until timeupdate is called', function(){
    OO.isAndroid = true;
    var spy = sinon.spy(wrapper, "seek");
    wrapper.setInitialTime(10);
    expect(spy.callCount).to.be(0);
    $(element).triggerHandler("timeupdate");
    expect(spy.callCount).to.be(1);
  });

  it('should delay initialTime on IE11 until timeupdate is called', function(){
    OO.isIE11Plus = true;
    var spy = sinon.spy(wrapper, "seek");
    wrapper.setInitialTime(10);
    expect(spy.callCount).to.be(0);
    $(element).triggerHandler("timeupdate");
    expect(spy.callCount).to.be(1);
  });

  it('should play if not seeking', function(){
    var spy = sinon.spy(element, "play");
    wrapper.play();
    expect(spy.callCount).to.be(1);
  });

  it('should not load on play if loaded', function(){
    wrapper.load();
    var spy = sinon.spy(element, "load");
    wrapper.play();
    expect(spy.callCount).to.be(0);
  });

  it('should load on play if not loaded', function(){
    var spy = sinon.spy(element, "load");
    wrapper.play();
    expect(spy.callCount).to.be(1);
  });

  it('should not play if seeking', function(){
    element.seeking = true;
    var spy = sinon.spy(element, "play");
    wrapper.play();
    expect(spy.callCount).to.be(0);
  });

  it('should act on initialTime if has played', function(){
    var spy = sinon.spy(wrapper, "seek");
    wrapper.play();
    wrapper.setInitialTime(10);
    expect(spy.callCount).to.be(1);
  });

  it('should act on initialTime if has played and video ended', function(){
    var spy = sinon.spy(wrapper, "seek");
    wrapper.play();
    $(element).triggerHandler("ended");
    wrapper.setInitialTime(10);
    expect(spy.callCount).to.be(1);
  });

  it('should call pause on element when wrapper paused', function(){
    wrapper.load();
    //wrapper.load calls element.pause, so spy on the pause after loading
    var spy = sinon.spy(element, "pause");
    wrapper.play();
    $(element).triggerHandler("playing");
    expect(spy.callCount).to.be(0);
    wrapper.pause();
    expect(spy.callCount).to.be(1);
  });

  it('should pause with no VTC notifications on the playing event if calling pause after calling play but before receiving the playing event', function(){
    wrapper.load();
    //wrapper.load calls element.pause, so spy on the pause after loading
    var spy = sinon.spy(element, "pause");
    wrapper.play();
    wrapper.pause();
    expect(spy.callCount).to.be(0);
    $(element).triggerHandler("playing");
    expect(spy.callCount).to.be(1);
    expect(spy.callCount).to.be(1);

    //check that another playing event does not pause the player again
    wrapper.play();
    $(element).triggerHandler("playing");
    expect(spy.callCount).to.be(1);

    //check that another pause is immediately honoroed rather than waiting on the playing event
    wrapper.pause();
    expect(spy.callCount).to.be(2);
  });

  it('should ignore seek if current time is equal to seek time', function(){
    element.duration = 10;
    element.currentTime = 0;
    stubSeekable(element, 0, 0);
    element.seekable.length = 0;
    var returns = wrapper.seek(0);
    expect(returns).to.be(false);
  });

  it('should ignore seek if seekrange is 0', function(){
    element.duration = 10;
    stubSeekable(element, 0, 0);
    element.seekable.length = 0;
    var returns = wrapper.seek(0);
    expect(returns).to.be(false);
    var returns = wrapper.seek(1);
    expect(returns).to.be(false);
  });

  it('should ignore seek for live streams with no DVR', function(){
    stubSeekable(element, 0, 0);
    wrapper.setVideoUrl("url", "mp4", true);
    element.duration = Infinity;
    var returns = wrapper.seek(1);
    expect(returns).to.be(false);
  });

  it('should NOT ignore seek for VOD stream even if duration of video is zero or Infinity or NaN', function(){
    wrapper.setVideoUrl("url", "mp4", false);
    element.duration = 0;
    element.currentTime = 0;
    setFullSeekRange(10);
    var returns = wrapper.seek(1);
    expect(returns).to.be(true);
    element.currentTime = 0;
    element.duration = Infinity;
    returns = wrapper.seek(1);
    expect(returns).to.be(true);
    element.currentTime = 0;
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
    expect(element.currentTime).to.eql(0);
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
    var spies = stubSeekable(element, 2, 10);
    element.seekable.length = 1;

    wrapper.seek(8);
    expect(spies.startSpy.callCount).to.be(0);
    expect(spies.endSpy.callCount).to.be(0);

    $(element).triggerHandler("canplay");
    wrapper.seek(8);
    expect(spies.startSpy.callCount).to.be(1);
    expect(spies.endSpy.callCount).to.be(1);
  });

  it('should reblock seekable from seeks upon load until video initialization in safari', function(){
    OO.isSafari = true;
    vtc.interface.EVENTS.DURATION_CHANGE = "durationchange";
    element.currentTime = 3;
    element.duration = 10;
    element.seekable.length = 1;

    var spies = stubSeekable(element, 2, 10);
    $(element).triggerHandler("canplay");
    wrapper.seek(8);
    expect(spies.startSpy.callCount).to.be(1);
    expect(spies.endSpy.callCount).to.be(1);

    spies.startSpy.reset();
    spies.endSpy.reset();
    wrapper.load();
    wrapper.seek(8);
    expect(spies.startSpy.callCount).to.be(0);
    expect(spies.endSpy.callCount).to.be(0);
  });

  it('DVR: should NOT ignore seek for live streams with DVR enabled', function() {
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    setDvr();
    expect(wrapper.seek(1)).to.be(true);
  });

  it('DVR: should NOT update currentTime when seek() is called with invalid value', function() {
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    var params;
    var dvrWindowSize = 1750;
    var spies = setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize);
    // Time shift is updated when calling seek, but shouldn't be updated again when seeked is fired
    wrapper.seek(dvrWindowSize / 2);
    // Simulating that DVR window changes while we were seeking, which would result in a different shift value
    spies.startSpy.restore();
    spies.endSpy.restore();
    setDvr(100, dvrWindowSize + 100);
    $(element).triggerHandler("seeked");
    // Current time should reflect shift calculated on wrapper.seeked() and shouldn't be updated after seeked event
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(dvrWindowSize / 2);
  });

  it('DVR: should adapt to changes in the DVR window', function() {
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    var params;
    var dvrWindowSize = 1750;
    var midpoint = dvrWindowSize / 2;
    var spies = setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    // Test seek with initial DVR window
    wrapper.seek(midpoint);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(midpoint);
    expect(Number(params.currentLiveTime)).to.be(midpoint);
    spies.startSpy.restore();
    spies.endSpy.restore();
    // Move DVR window forward
    setDvr(100, dvrWindowSize + 100);
    // Test seek with updated DVR window
    element.currentTime = dvrWindowSize + 100;
    wrapper.seek(midpoint);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("timeupdate");
    params = vtc.notifyParameters[1];
    expect(params.currentTime).to.be(midpoint);
    expect(Number(params.currentLiveTime)).to.be(midpoint + 100);
  });

  it('DVR: should update time shift when resuming after a pause', function() {
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    var params;
    var dvrWindowSize = 1800;
    var spies = setDvr(0, dvrWindowSize);
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
    spies.startSpy.restore();
    spies.endSpy.restore();
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    var params;
    var dvrWindowSize = 1800;
    var spies = setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    spies.startSpy.restore();
    spies.endSpy.restore();
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    var params;
    var dvrWindowSize = 1800;
    var midpoint = dvrWindowSize / 2;
    var spies = setDvr(0, dvrWindowSize);
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
    spies.startSpy.restore();
    spies.endSpy.restore();
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    var params;
    var dvrWindowSize = 1750;
    var spies = setDvr(0, dvrWindowSize);
    element.currentTime = dvrWindowSize;
    // Initial play
    wrapper.play();
    $(element).triggerHandler("playing");
    // Pause
    wrapper.pause();
    $(element).triggerHandler("pause");
    spies.startSpy.restore();
    spies.endSpy.restore();
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

  it('should return mute state when isMuted is called', function(){
    element.muted = true;
    expect(wrapper.isMuted()).to.eql(true);
    element.muted = false;
    expect(wrapper.isMuted()).to.eql(false);
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

  it('should notify of MUTED_PLAYBACK_FAILED when play promise fails and player detects that muted autoplay is not possible', function(){
    var catchCallback = null;
    var originalPlayFunction = element.play;
    // Video muted successfully but playback still failed
    element.muted = true;
    element.paused = true;
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
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.MUTED_PLAYBACK_FAILED);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should not notify of UNMUTED_PLAYBACK_FAILED when play promise fails with an unmuted video when the source has changed', function(){
    var catchCallback = null;
    var originalPlayFunction = element.play;
    element.src = "src1";
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
    element.src = "src2";
    catchCallback({});
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.UNMUTED_PLAYBACK_FAILED)).to.eql(false);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.MUTED_PLAYBACK_FAILED)).to.eql(false);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should not notify of MUTED_PLAYBACK_FAILED when play promise fails with a muted video when the source has changed', function(){
    var catchCallback = null;
    var originalPlayFunction = element.play;
    // Video muted successfully but playback still failed
    element.muted = true;
    element.paused = true;
    element.src = "src1";
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
    element.src = "src2";
    catchCallback({});
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.UNMUTED_PLAYBACK_FAILED)).to.eql(false);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.MUTED_PLAYBACK_FAILED)).to.eql(false);
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

  it('should notify of MUTED_PLAYBACK_SUCCEEDED when play promise is fulfilled with an muted video', function(){
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
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.UNMUTED_PLAYBACK_SUCCEEDED)).to.be(false);
    expect(vtc.notified[0]).to.eql(vtc.interface.EVENTS.MUTED_PLAYBACK_SUCCEEDED);
    // Restore original play function
    element.play = originalPlayFunction;
  });

  it('should prime a video element with play and pause', function(){
    var playSpy = sinon.spy(element, "play");
    var pauseSpy = sinon.spy(element, "pause");
    wrapper.primeVideoElement();
    expect(playSpy.callCount >= 1).to.be(true);
    expect(pauseSpy.callCount >= 1).to.be(true);
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
    var spy = sinon.spy(element, "pause");
    wrapper.load(false);
    wrapper.primeVideoElement();
    // Pause should not be called until promise is resolved
    expect(spy.callCount).to.be(0);
    thenCallback();
    expect(spy.callCount).to.be(1);
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
    var spy = sinon.spy(element, "pause");
    wrapper.load(false);
    wrapper.primeVideoElement();
    // Simulating that play() gets called before the original video.play promise from
    // the priming call is resolved
    wrapper.play();
    thenCallback();
    expect(spy.callCount).to.be(0);
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

  it('should not apply custom translate css on iPad when applying css', function(){
    OO.isIpad = true;
    element.videoWidth = 640;
    element.videoHeight = 480;
    var css = { "visibility" : "visible", "height" : "100%" };
    wrapper.applyCss(css);
    expect(element.style.left).to.not.be("50%");
    expect(element.style.top).to.not.be("50%");
    expect(element.style['WebkitTransform']).to.not.be.ok();
  });

  it('should pause the video element on destroy', function(){
    var spy = sinon.spy(element, "pause");
    expect(spy.callCount).to.be(0);
    wrapper.destroy();
    expect(spy.callCount).to.be(1);
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
    wrapper.setVideoUrl("url");
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions(language, closedCaptions, params);
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
    expect(element.children[0].getAttribute("kind")).to.eql("subtitles");
    expect(element.children[0].getAttribute("label")).to.eql("English");
    expect(element.children[0].getAttribute("src")).to.eql("http://ooyala.com");
    expect(element.children[0].getAttribute("srclang")).to.eql("en");
  });

  it('should set closed captions mode for in-stream captions', function(){
    element.textTracks = [{ mode: OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED, kind: "captions" }];
    wrapper.setVideoUrl("url");
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    element.textTracks.onaddtrack();
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    wrapper.setClosedCaptions("CC1", {}, { mode: "showing" });
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
  });

  it('should set both in-stream and external closed captions and switches between them', function(){
    element.textTracks = [{ kind: "captions" }, { kind: "captions" }];
    wrapper.setVideoUrl("url");
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    element.textTracks.onaddtrack();

    wrapper.setClosedCaptionsMode(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);

    wrapper.setClosedCaptions("CC1", {}, {mode: OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING});
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);

    wrapper.setClosedCaptions("CC2", {}, {mode: OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING});
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);

    wrapper.setClosedCaptions("en", closedCaptions, {mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN}); // this adds external captions
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[2].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN);
  });

  it('should only enable the in-manifest/in-stream track that matches language parameter', function() {
    element.textTracks = [
      { language: "", label: "", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" }
    ];
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    element.textTracks.onaddtrack();
    wrapper.setClosedCaptions("CC3", {}, { mode: OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING });
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    expect(element.textTracks[2].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
  });

  it('should disable closed captions if language is null', function() {
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions(language, closedCaptions, params);
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN);
    wrapper.setClosedCaptions(null, closedCaptions, params);
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
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
    expect(wrapper.getCurrentTime()).to.eql(0);
    element.currentTime = 1000000;
    expect(wrapper.getCurrentTime()).to.eql(1000000);
  });

  it('should not unmute if setVolume is called with a value of 0', function(){
    element.muted = true;
    wrapper.setVolume(0);
    expect(element.volume).to.eql(0);
    expect(element.muted).to.eql(true);
  });

  it('getAvailableAudio should return array of audio tracks', function(){
    var resAudioTracks;
    element.audioTracks = audioTracks;
    expect(element.audioTracks[0].id).to.eql('0');
    resAudioTracks = wrapper.getAvailableAudio();
    expect(resAudioTracks).to.eql([
      {id: "0", label: "eng", lang: "eng", enabled: true},
      {id: "1", label: "ger", lang: "ger", enabled: false}
    ]);
  });

  it('setAudio should set the audio by id', function(){
    wrapper.currentAudioId = "0";
    element.audioTracks = audioTracks;
    element.audioTracks.__proto__ = {
      getTrackById: vtc.getTrackById
    };
    // pass correct id
    var resWithCorrectId = wrapper.setAudio("1");

    expect(audioTracks).to.eql([
      {id: "0", kind: "main", label: "eng", language: "eng", enabled: false},
      {id: "1", kind: "main", label: "ger", language: "ger", enabled: true}
    ]);

    //pass wrong id
    var resWithWrongId = wrapper.setAudio("6789");

    expect(audioTracks).to.eql([
      {id: "0", kind: "main", label: "eng", language: "eng", enabled: false},
      {id: "1", kind: "main", label: "ger", language: "ger", enabled: true}
    ]);
  });

  it('test setPlaybackSpeed', function() {
    expect(wrapper.getPlaybackSpeed()).to.be(1);
    wrapper.setPlaybackSpeed(2);
    expect(wrapper.getPlaybackSpeed()).to.be(2);
    wrapper.setPlaybackSpeed(.5);
    expect(wrapper.getPlaybackSpeed()).to.be(.5);

    //speed should not be changed if you pass in bad values
    wrapper.setPlaybackSpeed();
    expect(wrapper.getPlaybackSpeed()).to.be(.5);
    wrapper.setPlaybackSpeed(null);
    expect(wrapper.getPlaybackSpeed()).to.be(.5);
    wrapper.setPlaybackSpeed("1");
    expect(wrapper.getPlaybackSpeed()).to.be(.5);
    wrapper.setPlaybackSpeed({});
    expect(wrapper.getPlaybackSpeed()).to.be(.5);
    wrapper.setPlaybackSpeed(NaN);
    expect(wrapper.getPlaybackSpeed()).to.be(.5);

    //test that the speed carries over to a new video
    wrapper.setVideoUrl("test");
    expect(wrapper.getPlaybackSpeed()).to.be(.5);
    //test that live video reset the value to 1
    wrapper.setVideoUrl("url", "mp4", true);
    element.duration = Infinity;
    expect(wrapper.getPlaybackSpeed()).to.be(1);
    //now that we are playing a live video, you shouldn't be able to set the speed
    wrapper.setPlaybackSpeed(.5);
    expect(wrapper.getPlaybackSpeed()).to.be(1);

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

  describe('Text Tracks', function() {
    let ccData, ccParams;

    beforeEach(function() {
      ccData = {
        locale: {
          en: 'English',
          fr: 'Français'
        },
        closed_captions_vtt: {
          en: {
            name: 'English',
            url: 'http://ooyala.com/en'
          },
          fr: {
            name: 'Français',
            url: 'http://ooyala.com/fr'
          }
        }
      };
      ccParams = {
        mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN
      };
    });

    it('should set crossorigin to "anonymous" when calling setClosedCaptions() but only if external captions are provided', function() {
      expect(element.getAttribute('crossorigin')).to.be(null);
      wrapper.setClosedCaptions('en', ccData, ccParams);
      expect(element.getAttribute('crossorigin')).to.be('anonymous');
      element.removeAttribute('crossorigin');
      expect(element.getAttribute('crossorigin')).to.be(null);
      wrapper.setClosedCaptions('en', {}, ccParams);
      expect(element.getAttribute('crossorigin')).to.be(null);
    });

    it('should defer external track addition until "canplay" event is fired', function() {
      const ccData2 = {
        locale: { es: 'Español' },
        closed_captions_vtt: {
          es: {
            name: 'Español',
            url: 'http://ooyala.com/es'
          }
        }
      };
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      wrapper.setClosedCaptions('en', ccData, ccParams);
      wrapper.setClosedCaptions('es', ccData2, ccParams);
      expect(element.textTracks.length).to.be(0);
      $(element).triggerHandler('canplay');
      expect(element.textTracks.length).to.be(3);
      expect(element.textTracks[0].mode).to.be(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
      expect(element.textTracks[1].mode).to.be(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
      expect(element.textTracks[2].mode).to.be(ccParams.mode);
    });

    it('should clear current subtitle cue when a different language is selected', function() {
      const spy = sinon.spy(
        vtc.interface, 'notify'
      ).withArgs(
        vtc.interface.EVENTS.CLOSED_CAPTION_CUE_CHANGED, ''
      );
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      $(element).triggerHandler('canplay');
      wrapper.setClosedCaptions('en', ccData, ccParams);
      wrapper.setClosedCaptions('fr', ccData, ccParams);
      expect(spy.callCount).to.be(1);
      expect(spy.args[0]).to.eql([vtc.interface.EVENTS.CLOSED_CAPTION_CUE_CHANGED, '']);
    });

    it('should disable all tracks except for the target track when a track is selected', function() {
      const targetLanguage = 'en';
      element.textTracks = [
        { language: "", label: "", kind: "subtitles", mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN },
        { language: "", label: "", kind: "subtitles", mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN },
        { language: "", label: "", kind: "subtitles", mode: OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN }
      ];
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      element.textTracks.onaddtrack();
      $(element).triggerHandler('canplay');
      for (let textTrack of element.textTracks) {
        expect(textTrack.mode).to.not.be(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
      }
      wrapper.setClosedCaptions(targetLanguage, ccData, ccParams);
      for (let textTrack of element.textTracks) {
        if (textTrack.language === targetLanguage) {
          expect(textTrack.mode).to.be(ccParams.mode);
        } else {
          expect(textTrack.mode).to.be(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
        }
      }
    });

    it('should set the target mode on a newly added target track after it is successfully added', function() {
      ccParams.mode = OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING;
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      $(element).triggerHandler('canplay');
      expect(element.textTracks.length).to.be(0);
      wrapper.setClosedCaptions('en', ccData, ccParams);
      expect(element.textTracks.length).to.be(2);
      expect(element.textTracks[0].mode).to.be(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
      expect(element.textTracks[1].mode).to.be(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    });

    it('should NOT add external VTT track with a source url that has already been added', function() {
      const ccData1 = {
        locale: { en: 'English' },
        closed_captions_vtt: {
          en: {
            name: 'English',
            url: 'http://same.old.url'
          }
        }
      };
      const ccData2 = {
        locale: { es: 'Español' },
        closed_captions_vtt: {
          es: {
            name: 'Español',
            url: 'http://same.old.url'
          }
        }
      };
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      $(element).triggerHandler('canplay');
      wrapper.setClosedCaptions('en', ccData1, ccParams);
      wrapper.setClosedCaptions('en', ccData2, ccParams);
      expect(element.textTracks.length).to.be(1);
      expect(element.textTracks[0].language).to.be('en');
    });

    it('should generate sequential track ids for external tracks', function() {
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      $(element).triggerHandler('canplay');
      wrapper.setClosedCaptions('en', ccData, ccParams);
      const trackElements = element.querySelectorAll('track');
      expect(trackElements.length).to.be(2);
      expect(trackElements[0].id).to.be('VTT1');
      expect(trackElements[1].id).to.be('VTT2');
    });

    it('should manually trigger addtrack event on Edge after adding external tracks', function() {
      OO.isEdge = true;
      const spy = sinon.spy(vtc.interface, 'notify');
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      $(element).triggerHandler('canplay');
      wrapper.setClosedCaptions('en', ccData, ccParams);
      const captionsFoundCount = spy.args.reduce((result, args) => (
        result += args[0] === vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING ? 1 : 0
      ), 0);
      // Explanation:
      // Two tracks were added. The mock implementation in setup.js will
      // notify once per each track, plus there will be one additional notification
      // per track due to this being Edge
      expect(captionsFoundCount).to.be(4);
    });

    it('should add external tracks with id stored in label attribute and set actual label after TextTrack object is added', function() {
      const spy = sinon.spy(TextTrackHelper.prototype, 'addTrack');
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      $(element).triggerHandler('canplay');
      wrapper.setClosedCaptions('en', ccData, ccParams);
      const expectedId = 'VTT1';
      const addTrackArgs = spy.args[0][0];
      const trackElements = element.querySelectorAll('track');
      expect(addTrackArgs.id).to.be(expectedId);
      expect(addTrackArgs.label).to.be(expectedId);
      expect(trackElements[0].id).to.be(expectedId);
      expect(trackElements[0].label).to.be(ccData.closed_captions_vtt.en.name);
      spy.restore();
    });

    it('should set oncuechange handler on active tracks', function() {
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      $(element).triggerHandler('canplay');
      wrapper.setClosedCaptions('en', ccData, ccParams);
      expect(typeof element.textTracks[0].oncuechange).to.be('function');
      expect(typeof element.textTracks[1].oncuechange).to.not.be('function');
    });

    it('should give priority to external tracks that match the target language when enabling tracks', function() {
      element.textTracks = [
        { language: "en", label: "Internal English", kind: "subtitles" },
      ];
      wrapper.setVideoUrl('url');
      $(element).triggerHandler('loadedmetadata');
      element.textTracks.onaddtrack();
      $(element).triggerHandler('canplay');
      wrapper.setClosedCaptions('es', ccData, ccParams);
      wrapper.setClosedCaptions('en', ccData, ccParams);
      expect(element.textTracks[0].label).to.be('Internal English');
      expect(element.textTracks[0].language).to.be('en');
      expect(element.textTracks[0].mode).to.be(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
      expect(element.textTracks[1].language).to.be('en');
      expect(element.textTracks[1].mode).to.be(OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN);
    });
  });

});
