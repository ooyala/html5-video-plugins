/*
 * https://github.com/Automattic/expect.js
 */

describe('main_html5 chrome underflow tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');
  jest.dontMock('../../utils/mock_vtc.js');
  require('../../utils/mock_vtc.js');

  var parentElement, wrapper, element, vtc, pluginFactory;
  var interval = 500;

  // Setup OO
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  // Load file under test
  jest.dontMock('../../../src/main/js/main_html5');
  require('../../../src/main/js/main_html5');

  OO.isChrome = true;

  beforeEach(function() {
    // Setup clock testing
    oldTimeout = window.setTimeout;
    oldInterval = window.setInterval;
    jasmine.Clock.useMock();
    setTimeout = jasmine.Clock.installed.setTimeout;
    setInterval = jasmine.Clock.installed.setInterval;

    // Setup the video element
    vtc = new mock_vtc();
    parentElement = $("<div>");
    wrapper = pluginFactory.create(parentElement, "test", vtc.interface, {});
    element = parentElement.children()[0];
  });

  afterEach(function() {
    if (wrapper) { wrapper.destroy(); }

    // Restore jest time mocking
    window.setTimeout = oldTimeout;
    window.setInterval = oldInterval;
  });

  // tests

  //// Waiting event ////

  it('should raise waiting event when the currentTime hasn\'t progressed for interval ms', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
  });

  it('should only raise waiting event only once', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    vtc.notifyParameters = [];
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([]);
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([]);
  });

  it('should not raise waiting event when the currentTime has progressed within interval ms', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    element.currentTime = 10;
    jasmine.Clock.tick(interval + 1);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    element.currentTime = 11;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
  });

  it('should not raise waiting event when the stream is paused', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    element.paused = true;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
  });

  it('should raise waiting event once the stream is unpaused', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    element.paused = true;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    element.paused = false;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
  });

  it('should not raise waiting event once the stream has ended', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    element.ended = true;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
  });

  it('should not raise waiting event before play is triggered', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
  });


  //// Buffered event ////

  // not raise buffered event if not waiting
  // raise buffered when done waiting
  // raise buffered only once
  // raise buffered when done waiting even if now paused
  // reraise waiting event after buffered


  //// When to watch ////

  it('should stop watching for rebuffers once the stream has ended', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    element.ended = true;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    element.ended = false;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
  });

  // not raise waiting when new stream loaded
  // all the times to stop watching
});
