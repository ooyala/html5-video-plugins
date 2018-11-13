/*
 * https://github.com/Automattic/expect.js
 */

describe('main_html5 factory tests', function () {
  // Setup
  var pluginFactory;
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  // override video element canPlayType to return true always
  var oldCreateElement = document.createElement;
  document.createElement = _.bind(function(type) {
    if (type === "video") {
      return { canPlayType: function() { return true; }};
    } else {
      return oldCreateElement(type);
    }
  }, this);

  // Load file under test
  jest.dontMock('../../../src/main/js/main_html5');
  require('../../../src/main/js/main_html5');

  // restore document.createElement
  document.createElement = oldCreateElement;

  var vtc = { EVENTS: { CAN_PLAY: "can_play" },
                        notify: function(){} };

  afterEach(function() {
    OO.isSafari = false;
  });

  it('should contain parameter \'name\'', function () {
    expect(pluginFactory.name).to.be.ok();
  });

  it('should provide a list of supported encodings', function(){
    // This is controlled by document.createElement("video").canPlayType(type);
    expect(pluginFactory.encodings).to.eql([OO.VIDEO.ENCODING.MP4, OO.VIDEO.ENCODING.AUDIO_OGG, OO.VIDEO.ENCODING.AUDIO_M4A, OO.VIDEO.ENCODING.WEBM, OO.VIDEO.ENCODING.HLS, OO.VIDEO.ENCODING.AKAMAI_HD2_VOD_HLS, OO.VIDEO.ENCODING.AKAMAI_HD2_HLS, OO.VIDEO.ENCODING.AUDIO_HLS]);
  });

  it('should provide a list of supported features', function(){
    expect(pluginFactory.features).to.eql([OO.VIDEO.FEATURE.CLOSED_CAPTIONS,
                                           OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE]);
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
    var elementWrapper = pluginFactory.create($("<div>"), "test", vtc, {});
    expect(elementWrapper).to.be.ok();
  });

  it('should not create an element when max elements reached', function(){
    pluginFactory.maxSupportedElements = 1;
    var controller = { "iAm" : "theController", EVENTS: { CAN_PLAY: "canplay" }, notify: function(){} };
    var elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player1");
    expect(elementWrapper).to.be.ok();
    elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player1");
    expect(elementWrapper).to.not.be.ok();
    pluginFactory.maxSupportedElements = 2;
    elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player2");
    expect(elementWrapper).to.be.ok();
    elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player2");
    expect(elementWrapper).to.be.ok();
    elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player2");
    expect(elementWrapper).to.not.be.ok();
  });

  it('should create an element when max elements not reached because elements destroyed', function(){
    pluginFactory.maxSupportedElements = 1;
    var controller = { "iAm" : "theController", EVENTS: { CAN_PLAY: "canplay" }, notify: function(){} };
    var elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player3");
    expect(elementWrapper).to.be.ok();
    var elementWrapper1 = pluginFactory.create($("<div>"), "test", controller, {}, "player3");
    expect(elementWrapper1).to.not.be.ok();
    elementWrapper.destroy();
    elementWrapper = pluginFactory.create($("<div>"), "test", controller, {}, "player3");
    expect(elementWrapper).to.be.ok();
  });

  it('should create elements when max elements not because no playerId specified', function(){
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

  it('should create element of class "video"', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("class")).to.eql("video");
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
    expect(element.getAttribute("preload")).to.eql("none");
    expect(element.getAttribute("loop")).to.not.be.ok();;
    expect(element.getAttribute("autoplay")).to.not.be.ok();;
  });

  // [PBW-5470]
  it('should set preload to "metadata" on desktop Safari', function(){
    OO.isSafari = true;
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", vtc, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("preload")).to.eql("metadata");
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
