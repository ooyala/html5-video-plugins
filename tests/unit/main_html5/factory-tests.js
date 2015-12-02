/*
 * https://github.com/Automattic/expect.js
 */

require('expect.js');
jest.dontMock('../../../js/main_html5');
jest.dontMock('jquery');

var pluginFactory;
OO = { Video: { plugin: function(plugin) { pluginFactory = plugin; } } };

var $ = OO.$ = require('jquery');
OO._ = require('underscore');
require('../../../js/main_html5');

describe('main_html5 factory tests', function () {
  it('should contain parameter \'name\'', function () {
    expect(pluginFactory.name).to.be.ok();
  });

  it('should provide a list of supported encodings', function(){
    expect(pluginFactory.encodings).to.eql(["mp4", "webm"]);
  });

  it('should report max supported elements', function(){
    expect(pluginFactory.maxSupportedElements).to.be.ok();
    expect(typeof pluginFactory.maxSupportedElements).to.eql("number");
    expect(pluginFactory.maxSupportedElements >= -1).to.be(true);
  });

  it('should be able to create an element', function(){
    var elementWrapper = pluginFactory.create($("<div>"), "test", {}, {});
    expect(elementWrapper).to.be.ok();
  });

  it('should create an element wrapper with provided contoller property', function(){
    var controller = { "iAm" : "theController" };
    var elementWrapper = pluginFactory.create($("<div>"), "test", controller, {});
    expect(elementWrapper.controller).to.eql(controller);
  });

  it('should create element under parentElement', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", {}, {});
    expect(parentElement.children().length).to.eql(1);
  });

  it('should create element of class "video"', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", {}, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("class")).to.eql("video");
  });

  it('should create element with given domId', function(){
    var domId = "testId";
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, domId, {}, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("id")).to.eql(domId);
  });

  it('should create element with given css', function(){
    var css = { "visibility" : "hidden" };
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", {}, css);
    var element = parentElement.children()[0];
    expect(element.getAttribute("style")).to.be.ok();
    expect(element.getAttribute("style")).to.eql("visibility: hidden;");
  });

  it('should create element with proper attributes', function(){
    var parentElement = $("<div>");
    pluginFactory.create(parentElement, "test", {}, {});
    var element = parentElement.children()[0];
    expect(element.getAttribute("preload")).to.eql("none");
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
    var elementWrapper = pluginFactory.create($("<div>"), "test", {}, {});
    expect(elementWrapper).to.not.be.ok();
  });
});
