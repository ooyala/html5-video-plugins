/*
 * https://github.com/Automattic/expect.js
 */

describe('bit_wrapper factory tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');
  jest.dontMock('../../utils/mock_bitplayer.js');
  require('../../utils/mock_bitplayer.js');

  // Setup
  var pluginFactory;
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin;} };

  // set up mock environment
  window.runningUnitTests = true;
  bitdash = function(domId) {
    return new mock_bitplayer();
  }

  // Load file under test

  jest.dontMock('../../../src/bit/js/bit_wrapper');
  require('../../../src/bit/js/bit_wrapper');

  var vtc = { EVENTS: { CAN_PLAY: "can_play" },
                        notify: function(){} };

  it('should contain parameter \'name\'', function () {
    expect(pluginFactory.name).to.be.ok();
  });

  it('should provide a list of supported encodings', function(){
    expect(pluginFactory.encodings).to.eql([OO.VIDEO.ENCODING.DASH, OO.VIDEO.ENCODING.HLS, OO.VIDEO.ENCODING.MP4]);
  });

  it('should provide a list of supported features', function(){
    expect(pluginFactory.features).to.eql([OO.VIDEO.FEATURE.CLOSED_CAPTIONS]);
  });

  it('should report the core technology of the video element', function(){
    expect(pluginFactory.technology).to.eql(OO.VIDEO.TECHNOLOGY.MIXED);
  });

  it('should report max supported elements', function(){
    expect(pluginFactory.maxSupportedElements).to.be.ok();
    expect(pluginFactory.maxSupportedElements).to.be.a("number");
    expect(pluginFactory.maxSupportedElements).to.be.above(-2);
  });

  it('should be able to create an element', function(){
    var elementWrapper = pluginFactory.create($("<div>"), "test", vtc, {});
    expect(elementWrapper).to.be.ok();
  });

  it('should create an element wrapper with provided contoller property', function(){
    var controller = { "iAm" : "theController", EVENTS: { CAN_PLAY: "canplay" }, notify: function(){} };
    var elementWrapper = pluginFactory.create($("<div>"), "test", controller, {});
    expect(elementWrapper.controller).to.eql(controller);
  });

  it('should create element under parentElement', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, {});
    expect(parentElement.children()).to.have.length(1);
  });

  it('should create element with id "test"', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("id")).to.eql("test");
  });

  it('should create element with given domId', function(){
    var domId = "testId";
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, domId, vtc, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("id")).to.eql(domId);
  });

  it('should create element with given css', function(){
    var css = { "visibility" : "hidden" };
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, css);
    var element = parentElement.children()[0];
    expect(element.getAttribute("style")).to.be.ok();
    expect(element.getAttribute("style")).to.contain("visibility");
    expect(element.getAttribute("style")).to.contain("hidden");
  });

  it('should create element with proper attributes', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("loop")).to.not.be.ok();;
    expect(element.getAttribute("autoplay")).to.not.be.ok();;
  });

  it('should remove list of encodings on destroy', function(){
    pluginFactory.destroy();
    expect(pluginFactory.encodings).to.eql([]);
  });

  it('should set ready to false on destroy', function(){
    // destroy done in pervious test.  The proper way to test this would be to re-create the plugin
    // before each test but this requires use of the require.cache function which is not available in jest.
    expect(pluginFactory.ready).to.be(false);
  });

  it('should not create elements after destroy is called', function(){
    // destroy done in pervious test.  The proper way to test this would be to re-create the plugin
    // before each test but this requires use of the require.cache function which is not available in jest.
    var elementWrapper = pluginFactory.create($("<div>"), "test", vtc, {});
    expect(elementWrapper).to.not.be.ok();
  });
});
