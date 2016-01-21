/*
 * https://github.com/Automattic/expect.js
 */

describe('bit_wrapper wrapper tests', function () {
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
  var pluginFactory, parentElement, wrapper, element, vtc, originalTimeout;
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

    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
  });

  afterEach(function() {
    OO.isAndroid = false;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    if (wrapper) { wrapper.destroy(); }
  });

  // tests

  it('should set the video url and return true', function(){
    var returns = wrapper.setVideoUrl("url");
    expect(returns).to.be(true);
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

  it('should call player load', function(){
    spyOn(player, "load");
    spyOn(player, "pause");
    wrapper.load(false);
    expect(player.load.wasCalled).to.be(true);
    expect(player.pause.wasCalled).to.be(false);
  });

  it('should not call load on loaded stream when not rewinding', function(){
    spyOn(player, "load");
    expect(player.load.callCount).to.eql(0);
    wrapper.load(false);
    expect(player.load.callCount).to.eql(1);
    wrapper.load(false);
    expect(player.load.callCount).to.eql(1);
  });

  it('should call pause stream when rewinding', function(){
    spyOn(player, "pause");
    expect(player.pause.callCount).to.eql(0);
    wrapper.load(true);
    expect(player.pause.callCount).to.eql(1);
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
    spyOn(player, "load");
    expect(player.load.callCount).to.eql(0);
    wrapper.load(false);
    expect(player.load.callCount).to.eql(1);
    wrapper.load(true);
    expect(player.load.callCount).to.eql(2);
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

  it('should play if not seeking', function(){
    spyOn(player, "play");
    wrapper.play();
    expect(player.play.wasCalled).to.be(true);
  });

  it('should not load on play if loaded', function(){
    wrapper.load();
    spyOn(player, "load");
    wrapper.play();
    expect(player.load.wasCalled).to.be(false);
  });

  it('should load on play if not loaded', function(){
    spyOn(player, "load");
    wrapper.play();
    expect(player.load.wasCalled).to.be(true);
  });

  it('should not act on initialTime if has played', function(){
    spyOn(wrapper, "seek");
    wrapper.play();
    wrapper.setInitialTime(10);
    expect(wrapper.seek.wasCalled).to.be(false);
  });

  it('should call pause on element when wrapper paused', function(){
    spyOn(player, "pause");
    wrapper.pause();
    expect(player.pause.wasCalled).to.be(true);
  });

  it('should ignore seek if seekrange is 0', function(){
    player.duration = 0;
    var returns = wrapper.seek(0);
    expect(returns).to.be(false);
    var returns = wrapper.seek(1);
    expect(returns).to.be(false);
  });

  it('should ignore seeking if seekvalue invalid', function(){
    player.duration = 10;
    var returns = wrapper.seek(true);
    expect(returns).to.be(false);
    var returns = wrapper.seek("hi");
    expect(returns).to.be(false);
  });

  it('should convert seek times outside of range into in-range', function(){
    player.duration = 10;
    var returns = wrapper.seek(-1);
    expect(returns).to.be(true);
    expect(player.currentTime).to.eql(0);
    var returns = wrapper.seek(11);
    expect(returns).to.be(true);
    expect(player.currentTime).to.eql(player.duration - 0.01);
  });

  it('should force seeks within SEEK_TO_END_LIMIT to seek to duration - 0.01', function(){
    OO.CONSTANTS = { SEEK_TO_END_LIMIT: 3 };
    player.duration = 10;
    var returns = wrapper.seek(player.duration - 3);
    expect(returns).to.be(true);
    expect(player.currentTime).to.eql(player.duration - 3);
    var returns = wrapper.seek(player.duration - 2.99);
    expect(returns).to.be(true);
    expect(player.currentTime).to.eql(player.duration - 0.01);
    var returns = wrapper.seek(player.duration - 1);
    expect(returns).to.be(true);
    expect(player.currentTime).to.eql(player.duration - 0.01);
  });

  it('should set volume if between 0 and 1', function(){
    wrapper.setVolume(0.1);
    expect(player.volume).to.eql(10); // bitmovin player's volume range is 1 - 100
    wrapper.setVolume(0);
    expect(player.volume).to.eql(0);
    wrapper.setVolume(1);
    expect(player.volume).to.eql(100);
  });

  it('should set volume to 1 if told to set above 1', function(){
    wrapper.setVolume(1.1);
    expect(player.volume).to.eql(100);
    wrapper.setVolume(2);
    expect(player.volume).to.eql(100);
  });

  it('should set volume to 0 if told to set below 0', function(){
    wrapper.setVolume(-0.1);
    expect(player.volume).to.eql(0);
    wrapper.setVolume(-2);
    expect(player.volume).to.eql(0);
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
    spyOn(player, "pause");
    expect(player.pause.wasCalled).to.be(false);
    wrapper.destroy();
    expect(player.pause.wasCalled).to.be(true);
  });

  it('should unset the src on destroy', function(){
    wrapper.setVideoUrl("url");
    wrapper.destroy();
    expect(player.exists).to.eql(false);
  });

  it('should set closed captions', function(){
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
    expect(player.trackId).to.eql("1");
    expect(player.cc_url).to.eql("http://ooyala.com");
    expect(player.cc_language).to.eql("en");
    expect(player.cc_name).to.eql("English");
    expect(player.cc_subtitle).to.eql("subtitle");
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
    wrapper.setClosedCaptions(null, closedCaptions, params);
    expect(player.trackId).to.eql(null);
  });

  it('should set the closed captions mode', function(){
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
    wrapper.setClosedCaptionsMode("hidden");
    var returns = player.getSubtitle();
    expect(returns).to.be(null);
    wrapper.setClosedCaptions(language, closedCaptions, params);
    wrapper.setClosedCaptionsMode("disabled");
    var returns = player.getSubtitle();
    expect(returns).to.be(null);
  });

  it('should set the crossorigin attribute', function(){
    expect(element.getAttribute("crossorigin")).to.not.be.ok();
    wrapper.setCrossorigin("anonymous");
    expect(element.getAttribute("crossorigin")).to.eql("anonymous");
    wrapper.setCrossorigin(null);
    expect(element.getAttribute("crossorigin")).to.not.be.ok();
  });

  it('should return current time on getCurrentTime', function(){
    player.duration = 100000000;
    wrapper.seek(10);
    expect(wrapper.getCurrentTime()).to.eql(10);
    wrapper.seek(0);
    expect(wrapper.getCurrentTime()).to.eql(0);
    wrapper.seek(1000000);
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
  it('should', function(){
  });

  // TODO: Complete this test once we have ability to simulate browsers and devices
  it('should apply cache buster to chrome', function(){
    var returns = wrapper.setVideoUrl("url");
    expect(returns).to.be(true);
    expect(element.src).to.eql("url");
  });

  it('should call "event" with specific parameters', function(){
    vtc.interface.notify("event", {"param":true});
    expect(vtc.notifyParameters).to.eql(["event", {"param":true}]);
  });
  */
});
