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
    var parentElement = $("<div>");
    var newElement = pluginFactory.create(parentElement, "test", {}, {});
    expect(newElement).to.be.ok();
  });

  it('should remove list of encodings on destroy', function(){
    pluginFactory.destroy();
    expect(pluginFactory.encodings).to.eql([]);
  });

  it('should set ready to false on destroy', function(){
    expect(pluginFactory.ready).to.be(false);
  });

  it('should not create elements after destroy is called', function(){
    var parentElement = $("<div>");
    var newElement = pluginFactory.create(parentElement, "test", {}, {});
    expect(newElement).to.not.be.ok();
  });
});
