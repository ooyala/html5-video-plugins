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
  var oldTimeout, oldInterval, oldClear;

  // Setup OO
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  // Load file under test
  jest.dontMock('../../../src/main/js/main_html5');
  require('../../../src/main/js/main_html5');

  beforeEach(function() {
    // Setup clock testing
    oldTimeout = window.setTimeout;
    oldInterval = window.setInterval;
    oldClear = window.clearInterval;
    jasmine.Clock.useMock();
    setTimeout = jasmine.Clock.installed.setTimeout;
    setInterval = jasmine.Clock.installed.setInterval;
    clearInterval = jasmine.Clock.installed.clearInterval;

    // Setup the video element
    OO.isChrome = true;
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
    window.clearInterval = oldClear;
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
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
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
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(true);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    vtc.reset();
    jasmine.Clock.tick(interval);
    expect(vtc.notified).to.have.length(0);
    jasmine.Clock.tick(interval);
    expect(vtc.notified).to.have.length(0);
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
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.currentTime = 11;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
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
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.paused = true;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
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
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.paused = true;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
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
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.ended = true;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should not raise waiting event before play is triggered', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should not raise waiting event if the player already has', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    $(element).triggerHandler("waiting");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(true);
    vtc.reset();
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });


  //// Buffered event ////

  it('should not raise buffered event when the currentTime progresses if not waiting', function(){
    vtc.interface.EVENTS.BUFFERED = "buffered";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 12;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.not.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);
  });

  it('should raise buffered event when the currentTime begins to progress after waiting', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.BUFFERED = "buffered";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 12;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);
  });

  it('should only raise one buffered event when the currentTime begins to progress after waiting', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.BUFFERED = "buffered";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 12;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);
    vtc.reset();
    element.currentTime = 14;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
  });

  it('should raise buffered event when the currentTime begins to progress after waiting even if now paused', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.BUFFERED = "buffered";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.paused = true;
    element.currentTime = 12;
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);
  });

  it('should be able to raise waiting and buffered events again after buffered', function() {
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.BUFFERED = "buffered";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    // first time
    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 12;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);

    // secondtime
    vtc.reset();
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(true);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 14;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);
  });

  it('should not raise buffered event if the player already has', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.BUFFERED = "buffered";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    $(element).triggerHandler("canplaythrough");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
    vtc.reset();
    element.currentTime = 12;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
  });

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
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.ended = true;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.ended = false;
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should stop watching for rebuffers once the ended event has been raised', function(){
    vtc.interface.EVENTS.ENDED = "ended";
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    $(element).triggerHandler("ended");
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should stop watching for rebuffers once the error event has been raised', function(){
    vtc.interface.EVENTS.ERROR = "error";
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    $(element).triggerHandler("error");
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should stop watching for rebuffers once the loadstart event has been raised', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    $(element).triggerHandler("loadstart");
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should stop watching for rebuffers once a new video is loaded', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    wrapper.setVideoUrl("newUrl");
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should not raise waiting event when the currentTime hasn\'t progressed on non-chrome platform', function(){
    OO.isChrome = false;
    vtc.interface.EVENTS.PLAYING = "playing";
    vtc.interface.EVENTS.WAITING = "waiting";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jasmine.Clock.tick(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jasmine.Clock.tick(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });
});
