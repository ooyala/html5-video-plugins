/*
 * https://github.com/Automattic/expect.js
 */

describe('main_html5 chrome underflow tests', function () {
  var parentElement, wrapper, element, vtc, pluginFactory;
  var interval = 300;
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
    jest.useFakeTimers();

    // Setup the video element
    OO.isChrome = true;
    OO.isFirefox = false;
    OO.isIos = false;
    OO.isIE11Plus = false;
    OO.isEdge = false;
    vtc = new mock_vtc();
    parentElement = $("<div>");
    wrapper = pluginFactory.create(parentElement, "test", vtc.interface, {});
    element = parentElement.children()[0];
  });

  afterEach(function() {
    if (wrapper) { wrapper.destroy(); }
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(true);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    vtc.reset();
    jest.advanceTimersByTime(interval);
    expect(vtc.notified).to.have.length(0);
    jest.advanceTimersByTime(interval);
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
    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.currentTime = 11;
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.paused = true;
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.paused = true;
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.paused = false;
    jest.advanceTimersByTime(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
  });

  it('Should remove attr "controls" on IOS when webkitendfullscreen event was fired', function(){
    OO.isIos = true;
    element.setAttribute("controls", "controls");
    expect(element.getAttribute("controls")).to.eql("controls");
    $(element).triggerHandler({ type: "webkitendfullscreen",
      target: { paused : true }
    });
    expect(element.getAttribute("controls")).to.eql(null);

    OO.isIos = false;
    element.setAttribute("controls", "controls");
    expect(element.getAttribute("controls")).to.eql("controls");
    $(element).triggerHandler({ type: "webkitendfullscreen",
      target: { paused : true }
    });
    expect(element.getAttribute("controls")).to.eql("controls");
  });

  it('should not raise waiting event once the stream has ended', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.ended = true;
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should not raise waiting event before play is triggered', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    vtc.interface.EVENTS.PLAYING = "playing";
    element.currentSrc = "url";
    element.currentTime = 10;
    $(element).triggerHandler("playing");
    element.paused = false;

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    $(element).triggerHandler("waiting");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(true);
    vtc.reset();
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 12;
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 12;
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 12;
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);
    vtc.reset();
    element.currentTime = 14;
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.paused = true;
    element.currentTime = 12;
    jest.advanceTimersByTime(interval);
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
    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 12;
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);

    // secondtime
    vtc.reset();
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(true);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    element.currentTime = 14;
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    $(element).triggerHandler("canplaythrough");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
    vtc.reset();
    element.currentTime = 12;
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.ended = true;
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    element.ended = false;
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    $(element).triggerHandler("ended");
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    $(element).triggerHandler("error");
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    $(element).triggerHandler("loadstart");
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
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

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    wrapper.setVideoUrl("newUrl");
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });


  //// Platforms ////

  it('should raise waiting event when the currentTime hasn\'t progressed on iOS platform', function(){
    OO.isIos = false;
    vtc.interface.EVENTS.PLAYING = "playing";
    vtc.interface.EVENTS.WAITING = "waiting";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(true);
  });

  it('should raise waiting event when the currentTime hasn\'t progressed on IE11 platform', function(){
    OO.isIE11Plus = false;
    vtc.interface.EVENTS.PLAYING = "playing";
    vtc.interface.EVENTS.WAITING = "waiting";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(true);
  });

  it('should raise buffered event after waiting on MS Edge when currentTime has progressed', function(){
    OO.isChrome = false;
    OO.isEdge = true;
    vtc.interface.EVENTS.BUFFERED = "buffered";
    element.currentSrc = "url";
    wrapper.play();
    $(element).triggerHandler("playing");
    $(element).triggerHandler("waiting");
    element.currentTime = 10;
    $(element).triggerHandler("timeupdate");
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
  });

  it('should not raise waiting event when the currentTime hasn\'t progressed on most platforms', function(){
    OO.isChrome = false;
    OO.isIE11Plus = false;
    OO.isIos = false;
    vtc.interface.EVENTS.PLAYING = "playing";
    vtc.interface.EVENTS.WAITING = "waiting";
    element.currentSrc = "url";
    element.currentTime = 10;
    wrapper.play();
    $(element).triggerHandler("playing");
    element.paused = false;

    jest.advanceTimersByTime(interval + 1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
    jest.advanceTimersByTime(interval);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should raise buffered event when canplay is raised after waiting on iOS', function(){
    element.currentSrc = "url";
    vtc.interface.EVENTS.BUFFERED = "buffered";
    vtc.interface.EVENTS.WAITING = "waiting";
    OO.isIos = true;
    OO.isChrome = false;
    $(element).triggerHandler("canplay");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    $(element).triggerHandler("waiting");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    $(element).triggerHandler("canplay");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
  });

  it('should raise buffered event when canplay is raised after waiting on firefox', function(){
    element.currentSrc = "url";
    vtc.interface.EVENTS.BUFFERED = "buffered";
    vtc.interface.EVENTS.WAITING = "waiting";
    OO.isFirefox = true;
    OO.isChrome = false;
    $(element).triggerHandler("canplay");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    $(element).triggerHandler("waiting");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(false);
    $(element).triggerHandler("canplay");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.BUFFERED)).to.be(true);
  });
});
