/*
 * Jest Test Cases for Youtube Factory.
 */

describe('Youtube factory tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');

  // Setup
  var pluginFactory;
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  // override video element canPlayType to return true always
  var oldCreateElement = document.createElement;
  document.createElement = _.bind(function(type) {
    if (type === "div") {
      return { canPlayType: function() { return true; }};
    } else {
      return oldCreateElement(type);
    }
  }, this);

  // Load file under test
  jest.dontMock('../../../src/youtube/js/youtube');
  require('../../../src/youtube/js/youtube');

  // restore document.createElement
  document.createElement = oldCreateElement;

  var vtc = { EVENTS: { CAN_PLAY: "can_play" },
                        notify: function(){} };



  it('should contain parameter \'name\'', function () {
    expect(pluginFactory.name).to.be.ok();
  });

  it('should provide a list of supported encodings', function(){
    // This is controlled by document.createElement("video").canPlayType(type);
    expect(pluginFactory.encodings).to.eql([OO.VIDEO.ENCODING.MP4]);
  });

  it('should provide a list of supported features', function(){
    expect(pluginFactory.features).to.eql([OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE,
                                           OO.VIDEO.FEATURE.BITRATE_CONTROL]);
  });

  it('should report the core technology of the video element', function(){
    expect(pluginFactory.technology).to.eql(OO.VIDEO.TECHNOLOGY.HTML5);
  });

  it('should report max supported elements', function(){
    expect(pluginFactory.maxSupportedElements).to.be.ok();
    expect(pluginFactory.maxSupportedElements).to.be.a("number");
    expect(pluginFactory.maxSupportedElements).to.be.above(-2);
  });

  it('should be able to create an element', function(){
    var elementWrapper = pluginFactory.create($("<div>"), "test", vtc, {},"1");
    expect(elementWrapper).to.be.ok();
  });


  it('should create an element because element destroyed', function(){
    pluginFactory.maxSupportedElements = 1;
    var controller = { "iAm" : "theController", EVENTS: { CAN_PLAY: "canplay" }, notify: function(){} };
    var elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player3");
    expect(elementWrapper).to.be.ok();
    elementWrapper.destroy();
    elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player3");
    expect(elementWrapper).to.be.ok();
  });

 it('should create elements when max elements not reached because no playerId is specified', function(){
    pluginFactory.maxSupportedElements = 1;
    var controller = { "iAm" : "theController", EVENTS: { CAN_PLAY: "canplay" }, notify: function(){} };
    var elementWrapper = pluginFactory.create($("<div>"), "test", controller, {});
    expect(elementWrapper).to.be.ok();
    elementWrapper = pluginFactory.create($("<div>"), "test", controller, {});
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

  it('should create element of id "player"', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("id")).to.eql("player");
  });


  it('should create element with position absolute', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("style")).to.be.ok();
    expect(element.getAttribute("style")).to.contain("position");
    expect(element.getAttribute("style")).to.contain("absolute");
    expect(element.getAttribute("style")).to.contain("top");
    expect(element.getAttribute("style")).to.contain("0px");
    expect(element.getAttribute("style")).to.contain("left");
    expect(element.getAttribute("style")).to.contain("0px");
  });

  it('should create element with proper attributes', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("autoplay")).to.not.be.ok();
  });

  it('should remove list of encodings on destroy', function(){
    pluginFactory.destroy();
    expect(pluginFactory.encodings).to.eql([]);
  });

  it('should not create elements after destroy is called', function(){
    // destroy done in pervious test.  The proper way to test this would be to re-create the plugin
    // before each test but this requires use of the require.cache function which is not available in jest.
    var elementWrapper = pluginFactory.create($("<div>"), "test", vtc, {});
    expect(elementWrapper).to.not.be.ok();
  });
});
