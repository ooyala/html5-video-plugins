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

  // Load file under test
  jest.dontMock('../../../src/main/js/main_html5');
  require('../../../src/main/js/main_html5');

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
    OO.isIE = false;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    if (wrapper) { wrapper.destroy(); }
  });

  // helper functions
  var setFullSeekRange = function(duration) {
    element.duration = duration;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(duration);
    element.seekable.length = 1;
  }

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

  it('should ignore seek for live streams', function(){
    wrapper.setVideoUrl("url", "mp4", true);
    element.duration = 100;
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
    OO.CONSTANTS = { SEEK_TO_END_LIMIT: 3 };
    var duration = 10;
    setFullSeekRange(duration);
    var returns = wrapper.seek(duration - 3);
    expect(returns).to.be(true);
    expect(element.currentTime).to.eql(duration - 3);
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

  it('should notify VOLUME_CHANGE on volume change of video with empty string', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumeChange";
    element.currentSrc = "";
    vtc.notified = [];
    wrapper.setVolume(0.3);
    expect(vtc.notified.length).to.eql(2);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.3 }]);
    vtc.notifyParameters = null;
    vtc.notified = [];
    element.currentSrc = null;
    wrapper.setVolume(0.2);
    expect(vtc.notified.length).to.eql(2);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.2 }]);
    vtc.notifyParameters = null;
    vtc.notified = [];
    element.currentSrc = "url";
    wrapper.setVolume(0.5);
    expect(vtc.notified.length).to.eql(1);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.5 }]);
  });

  it('should prime a video element with play and pause', function(){
    spyOn(element, "play");
    spyOn(element, "pause");
    wrapper.primeVideoElement();
    expect(element.play.wasCalled).to.be(true);
    expect(element.pause.wasCalled).to.be(true);
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
    OO.CONSTANTS = {
      CLOSED_CAPTIONS: {
        SHOWING: "showing",
        HIDDEN: "hidden",
        DISABLED: "disabled"
      }
    };
    var language = "en";
    var closedCaptions = {
      closed_captions_vtt: {
        en: {
          name: "English",
          url: "http://ooyala.com"
        }
      }
    };
    var params = {
      mode: "showing"
    };

    wrapper.setClosedCaptions(language, closedCaptions, params);
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
    expect(element.children[0].getAttribute("class")).to.eql("track_cc");
    expect(element.children[0].getAttribute("kind")).to.eql("subtitles");
    expect(element.children[0].getAttribute("label")).to.eql("English");
    expect(element.children[0].getAttribute("src")).to.eql("http://ooyala.com");
    expect(element.children[0].getAttribute("srclang")).to.eql("en");
  });

  it('should set closed captions mode for in-stream captions', function(){
    OO.CONSTANTS = {
      CLOSED_CAPTIONS: {
        SHOWING: "showing",
        HIDDEN: "hidden",
        DISABLED: "disabled"
      }
    };

    element.textTracks = [{ mode: OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED, kind: "captions" }];
    $(element).triggerHandler("playing");
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
    wrapper.setClosedCaptions("CC", null, { mode: "showing" });
    expect(element.textTracks[0].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING);
  });

  it('should set both in-stream and external closed captions and switches between them', function(){
    OO.CONSTANTS = {
      CLOSED_CAPTIONS: {
        SHOWING: "showing",
        HIDDEN: "hidden",
        DISABLED: "disabled"
      }
    };
    var closedCaptions = {
      closed_captions_vtt: {
        en: {
          name: "English",
          url: "http://ooyala.com"
        }
      }
    };
    
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
    expect(element.textTracks[1].mode).to.eql(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
  });

  it('should remove closed captions if language is null', function(){
    var language = "en";
    var closedCaptions = {
      closed_captions_vtt: {
        en: {
          name: "English",
          url: "http://ooyala.com"
        }
      }
    };
    var params = {
      mode: "showing"
    };

    wrapper.setClosedCaptions(language, closedCaptions, params);
    expect(element.children.length > 0).to.be(true);
    expect(element.children[0].tagName).to.eql("TRACK");
    wrapper.setClosedCaptions(null, closedCaptions, params);
    expect(element.children.length).to.eql(0);
  });

  it('should set the closed captions mode', function(){
    OO.CONSTANTS = {
      CLOSED_CAPTIONS: {
        SHOWING: "showing",
        HIDDEN: "hidden",
        DISABLED: "disabled"
      }
    };
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

  /*
  // TODO: Complete this test once we have ability to simulate browsers and devices
  it('should apply cache buster to chrome', function(){
    var returns = wrapper.setVideoUrl("url");
    expect(returns).to.be(true);
    expect(element.src).to.eql("url");
  });
  */
});
