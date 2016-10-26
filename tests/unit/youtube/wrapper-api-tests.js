/*
 * Jest Test Cases for Youtube Wrapper.
 */

describe('youtube wrapper tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');
  jest.dontMock('../../utils/mock_vtc.js');
  require('../../utils/mock_vtc.js');

  var pluginFactory, parentElement, wrapper, element, vtc, originalTimeout;

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
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
    OO.isEdge = false;
    OO.isAndroid = false;
  });

  afterEach(function() {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    if (wrapper) { $(element).triggerHandler("destroy"); }
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
  });

  it('should return false if the url is empty', function(){
    var returns = wrapper.setVideoUrl("");
    expect(returns).to.not.be(true);
  });

});
