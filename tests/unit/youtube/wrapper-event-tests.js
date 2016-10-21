/*
 * Jest Test Cases for Youtube Wrapper events.
 */

describe('youtube wrapper tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');
  jest.dontMock('../../utils/mock_vtc.js');
  require('../../utils/mock_vtc.js');

  var pluginFactory, parentElement, wrapper, element, vtc;

  // Setup
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  // Load file under test
  jest.dontMock('../../../src/youtube/js/youtube');
  require('../../../src/youtube/js/youtube');

  beforeEach(function() {
    vtc = new mock_vtc();
    parentElement = $("<div>");
    wrapper = pluginFactory.create(parentElement, "test", vtc.interface, {});
    element = parentElement.children()[0];
    OO.isSafari = false;
    OO.isAndroid = false;
    OO.isFirefox = false;
  });

  afterEach(function() {
    if (wrapper) { wrapper.destroy(); }
  });

  
  it('should not undo seek if disableNativeSeek=false on video \'seeked\' event', function(){
    wrapper.disableNativeSeek = false;
    element.currentTime = 10;
    $(element).triggerHandler("timeupdate");
    element.currentTime = 20;
    $(element).triggerHandler("seeked");
    expect(element.currentTime).to.eql(20);
  });

  it('should not undo seek if disableNativeSeek on video seeked if new position is same as previous', function(){
    wrapper.disableNativeSeek = false;
    element.currentTime = 10;
    $(element).triggerHandler("timeupdate");
    $(element).triggerHandler("seeked");
    expect(element.currentTime).to.eql(10);
  });

  it('should not undo seek if disableNativeSeek on video seeked if floor new position is same as floor of previous', function(){
    wrapper.disableNativeSeek = false;
    element.currentTime = 10.4;
    $(element).triggerHandler("timeupdate");
    element.currentTime = 10.5;
    $(element).triggerHandler("seeked");
    expect(element.currentTime).to.eql(10.5);
  });

});
