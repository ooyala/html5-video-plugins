/*
 * https://github.com/Automattic/expect.js
 */

require("expect.js");
jest.dontMock('../../js/main_html5');

var pluginFactory;
OO = { Video: { plugin: function(plugin) { pluginFactory = plugin; } } };
var basicHtml5 = require('../../js/main_html5');

describe('basic_html5', function () {
  it('factory: should contain parameter \'name\'', function () {
    expect(pluginFactory.name).to.be.ok();
  });

  it('factory: should provide a list of supported encodings', function(){
    expect(pluginFactory.encodings).to.eql(["mp4", "webm"]);
  });

  it('factory: should report max supported elements', function(){
    expect(pluginFactory.maxSupportedElements).to.be.ok();
    expect(typeof pluginFactory.maxSupportedElements).to.eql("number");
    expect(pluginFactory.maxSupportedElements >= -1).to.be(true);
  });
});
