/*
 * https://github.com/Automattic/expect.js
 */

describe('main_html5 wrapper tests', function () {
  // Load test helpers
  require('../../utils/test_lib.js');
  jest.dontMock('../../utils/mock_vtc.js');
  require('../../utils/mock_vtc.js');

  var pluginFactory, parentElement, wrapper, element, vtc;

  // Setup
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  // Load file under test
  jest.dontMock('../../../src/main/js/main_html5');
  require('../../../src/main/js/main_html5');

  beforeEach(function() {
    vtc = new mock_vtc();
    parentElement = $("<div>");
    wrapper = pluginFactory.create(parentElement, "test", vtc.interface, {});
    element = parentElement.children()[0];
  });

  afterEach(function() {
    OO.isSafari = false;
    OO.isAndroid = false;
    if (wrapper) { wrapper.destroy(); }
  });

  // tests

  it('should not dequeue seek on \'loadedmetadata\' event if no seek enqueued', function(){
    spyOn(wrapper, "seek");
    $(element).triggerHandler("loadedmetadata");
    expect(wrapper.seek.wasCalled).to.be(false);
  });

  it('should dequeue seek on \'loadedmetadata\' event', function(){
    wrapper.setInitialTime(10);
    spyOn(wrapper, "seek");
    $(element).triggerHandler("loadedmetadata");
    expect(wrapper.seek.wasCalled).to.be(true);
  });

  it('should notify PROGRESS on \'progress\' event', function(){
    vtc.interface.EVENTS.PROGRESS = "progress";
    element.currentTime = 3;
    element.duration = 10;
    $(element).triggerHandler("progress");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PROGRESS,
      {
        "currentTime" : 3,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);
  });

  it('should notify PROGRESS on \'progress\' event with buffer range and seek range', function(){
    vtc.interface.EVENTS.PROGRESS = "progress";
    element.currentTime = 3;
    element.duration = 10;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(10);
    element.seekable.length = 1;
    spyOn(element.buffered, "end").andReturn(10);
    element.buffered.length = 1;
    $(element).triggerHandler("progress");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PROGRESS,
      {
        "currentTime" : 3,
        "duration" : 10,
        "buffer" : 10,
        "seekRange" : {"start": 0, "end" : 10}
      }]);
  });

  it('should notify PROGRESS on \'progress\' event resolves duration', function(){
    vtc.interface.EVENTS.PROGRESS = "progress";
    element.currentTime = 3;
    element.duration = "testing";
    $(element).triggerHandler("progress");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PROGRESS,
      {
        "currentTime" : 3,
        "duration" : 0,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);
    element.duration = Infinity;
    $(element).triggerHandler("progress");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PROGRESS,
       {
         "currentTime" : 3,
         "duration" : 0,
         "buffer" : 0,
         "seekRange" : {"start": 0, "end" : 0}
       }]);
  });

  it('should notify ERROR on video \'error\' event', function(){
    vtc.interface.EVENTS.ERROR = "error";
    $(element).triggerHandler("error");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: -1}]);
    $(element).triggerHandler({ type:"error",  target: { error: { code: 2 }}});
    element.error = { code: 2}
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: 2}]);
    $(element).triggerHandler({ type:"error",  target: { error: null} });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: -1}]);
    $(element).triggerHandler({ type:"error",  target: { error: { code: 0 }}});
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: 0}]);
  });

  it('should not notify ERROR on video \'error\' event with code 4 and empty src', function(){
    vtc.interface.EVENTS.ERROR = "error";
    $(element).attr("src", "");
    target = element;
    target.error = { code: 4 };
    $(element).triggerHandler({ type:"error",  target: target });
    expect(vtc.notifyParameters).to.eql([undefined]);
    target.error = { code: 2 };
    $(element).triggerHandler({ type:"error",  target: target });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: 2}]);
    $(element).attr("src", "url");
    target = element;
    target.error = { code: 4 };
    $(element).triggerHandler({ type:"error",  target: target });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: 4}]);
  });

  it('should not notify ERROR on video \'error\' event with code 4 and "null" src', function(){
    vtc.interface.EVENTS.ERROR = "error";
    $(element).attr("src", "null");
    target = element;
    target.error = { code: 4 };
    $(element).triggerHandler({ type:"error",  target: target });
    expect(vtc.notifyParameters).to.eql([undefined]);
    target.error = { code: 2 };
    $(element).triggerHandler({ type:"error",  target: target });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: 2}]);
    $(element).attr("src", "url");
    target = element;
    target.error = { code: 4 };
    $(element).triggerHandler({ type:"error",  target: target });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: 4}]);
  });

  it('should notify STALLED on video \'stalled\' event', function(){
    vtc.interface.EVENTS.STALLED = "stalled";
    element.currentSrc = "url";
    $(element).triggerHandler({ type: "stalled", target: {currentTime : 0}});
    expect(vtc.notifyParameters.length).to.eql(2);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.STALLED, { url : "url"}]);
  });

  // TODO: Create test case for stalled on iPad once we have platform simulation

  it('should notify BUFFERED on video \'canPlayThrough\' event', function(){
    vtc.interface.EVENTS.BUFFERED = "buffered";
    element.currentSrc = "url";
    $(element).triggerHandler("canplaythrough");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);
  });

  it('should notify PLAYING on video \'playing\' event', function(){
    vtc.interface.EVENTS.PLAYING = "playing";
    $(element).triggerHandler("playing");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PLAYING]);
  });

  it('should notify ASSET_DIMENSION on first \'canPlay\' event', function(){
    vtc.interface.EVENTS.ASSET_DIMENSION = "assetDimension";
    var videoDimensions = {width: 640, height: 480};
    element.videoWidth = videoDimensions.width;
    element.videoHeight = videoDimensions.height;
    $(element).triggerHandler("canplay");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ASSET_DIMENSION, videoDimensions]);
  });

  it('should notify CAPTIONS_FOUND_ON_PLAYING on first video \'playing\' event if video has cc', function(){
    element.textTracks = [{ kind: "captions" }];
    vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING = "captionsFoundOnPlaying";
    $(element).triggerHandler("playing");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING]);
  });

  it('should notify WAITING on video \'waiting\' event', function(){
    vtc.interface.EVENTS.WAITING = "waiting";
    element.currentSrc = "url";
    $(element).triggerHandler("waiting");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
  });

  it('should notify SEEKING on video \'seeking\' event', function(){
    vtc.interface.EVENTS.SEEKING = "seeking";
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.SEEKING]);
  });

  it('should not raise seeking before initial time has seeked', function(){
    vtc.interface.EVENTS.SEEKING = "seeking";
    element.duration = 20;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.seekable.length = 1;
    wrapper.setInitialTime(10);
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.SEEKING);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.SEEKING);
  });

  it('should raise seeking before initial time has seeked if initialtime is 0', function(){
    vtc.interface.EVENTS.SEEKING = "seeking";
    element.duration = 20;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.seekable.length = 1;
    wrapper.setInitialTime(0);
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.SEEKING);
  });

  it('should dequeue play command if seeking completed', function(){
    element.seeking = true;
    spyOn(element, "play");
    wrapper.play();
    element.seeking = false;
    $(element).triggerHandler("seeked");
    expect(element.play.wasCalled).to.be(true);
  });

  it('should not dequeue play command if stream paused before seeking completed', function(){
    element.seeking = true;
    spyOn(element, "play");
    wrapper.play();
    wrapper.pause();
    element.seeking = false;
    $(element).triggerHandler("seeked");
    expect(element.play.wasCalled).to.be(false);
  });

  it('should notify SEEKED on video \'seeked\' event', function(){
    vtc.interface.EVENTS.SEEKED = "seeked";
    $(element).triggerHandler("seeked");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.SEEKED]);
  });

  it('should not raise seeked when initial time is set to non-zero', function(){
    vtc.interface.EVENTS.SEEKED = "seeked";
    element.duration = 20;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.seekable.length = 1;
    wrapper.setInitialTime(10);
    $(element).triggerHandler("seeked");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.SEEKED);
    $(element).triggerHandler("seeked");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.SEEKED);
  });

  it('should raise seeked before initial time has seeked if initialtime is 0', function(){
    vtc.interface.EVENTS.SEEKED = "seeked";
    element.duration = 20;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.seekable.length = 1;
    wrapper.setInitialTime(0);
    $(element).triggerHandler("seeked");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.SEEKED);
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
    wrapper.disableNativeSeek = true;
    element.currentTime = 10;
    $(element).triggerHandler("timeupdate");
    $(element).triggerHandler("seeked");
    expect(element.currentTime).to.eql(10);
  });

  it('should not undo seek if disableNativeSeek on video seeked if floor new position is same as floor of previous', function(){
    wrapper.disableNativeSeek = true;
    element.currentTime = 10.4;
    $(element).triggerHandler("timeupdate");
    element.currentTime = 10.5;
    $(element).triggerHandler("seeked");
    expect(element.currentTime).to.eql(10.5);
  });

  it('should undo seek if disableNativeSeek on video \'seeked\' event', function(){
    wrapper.disableNativeSeek = true;
    element.currentTime = 10;
    $(element).triggerHandler("timeupdate");
    element.currentTime = 20;
    $(element).triggerHandler("seeked");
    expect(element.currentTime).to.eql(10);
  });

  it('should notify ENDED on video \'ended\' event', function(){
    vtc.interface.EVENTS.ENDED = "ended";
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
  });

  it('should only raise ended event once per stream', function(){
    vtc.interface.EVENTS.ENDED = "ended";
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
    vtc.notifyParameters = null;
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql(null);
    wrapper.play(false);
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
  });

  it('should unblock raising of ended event after a new stream begins loading', function(){
    vtc.interface.EVENTS.ENDED = "ended";
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
    vtc.notifyParameters = null;
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql(null);
    $(element).triggerHandler("loadstart");
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
  });

  // TODO: When we have platform testing support, test for iOS behavior for ended event raised when ended != true

  it('should not block seekable on video initialization in safari', function(){
    OO.isSafari = true;
    vtc.interface.EVENTS.DURATION_CHANGE = "durationchange";
    element.currentTime = 3;
    element.duration = 10;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(10);
    element.seekable.length = 1;
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);

    $(element).triggerHandler("canplay");
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 10}
      }]);
  });

  it('should notify DURATION_CHANGE on video \'durationchange\' event', function(){
    vtc.interface.EVENTS.DURATION_CHANGE = "durationchange";
    element.currentTime = 3;
    element.duration = 10;
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);
  });


  it('should notify DURATION_CHANGE on video \'durationchange\' event with buffer range and seek range', function(){
    vtc.interface.EVENTS.DURATION_CHANGE = "durationChange";
    element.currentTime = 3;
    element.duration = 10;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(10);
    element.seekable.length = 1;
    spyOn(element.buffered, "end").andReturn(10);
    element.buffered.length = 1;
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "duration" : 10,
        "buffer" : 10,
        "seekRange" : {"start": 0, "end" : 10}
      }]);
  });

  it('should not raise durationChange before initial time is used', function(){
    vtc.interface.EVENTS.DURATION_CHANGE = "durationChange";
    OO.isAndroid = true;
    element.duration = 20;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.seekable.length = 1;
    wrapper.setInitialTime(10);
    element.currentTime = 9;
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.DURATION_CHANGE);
    $(element).triggerHandler("timeupdate");
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.DURATION_CHANGE);
    element.currentTime = 11;
    $(element).triggerHandler("timeupdate");
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.DURATION_CHANGE);
  });

  it('should raise durationchange before initial time is used if the initial time position is passed', function(){
    vtc.interface.EVENTS.DURATION_CHANGE = "durationchange";
    OO.isAndroid = true;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.duration = 20;
    element.seekable.length = 1;
    element.currentTime = 11;
    wrapper.setInitialTime(10);
    $(element).triggerHandler("timeupdate");
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.DURATION_CHANGE);
  });

  it('should notify TIME_UPDATE on video \'timeupdate\' event', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeUpdate";
    element.currentTime = 3;
    element.duration = 10;
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE,
      {
        "currentTime" : 3,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);
  });

  it('should notify TIME_UPDATE on video \'timeupdate\' event with buffer range and seek range', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeUpdate";
    element.currentTime = 3;
    element.duration = 10;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(10);
    element.seekable.length = 1;
    spyOn(element.buffered, "end").andReturn(10);
    element.buffered.length = 1;
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE,
      {
        "currentTime" : 3,
        "duration" : 10,
        "buffer" : 10,
        "seekRange" : {"start": 0, "end" : 10}
      }]);
  });

  it('should not notify TIME_UPDATE on video \'timeupdate\' event if seeking', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeUpdate";
    element.currentTime = 3;
    element.duration = 10;
    $(element).triggerHandler("seeking");
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.TIME_UPDATE);
  });

  it('should dequeue seek and fail on video \'timeupdate\' event if not seekable', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeUpdate";
    wrapper.setInitialTime(10);
    spyOn(wrapper, "seek").andCallThrough();
    $(element).triggerHandler("timeupdate");
    expect(wrapper.seek.callCount).to.be(1);
    $(element).triggerHandler("timeupdate");
    expect(wrapper.seek.callCount).to.be(2);
    expect(element.currentTime).to.eql(null);
  });

  it('should dequeue seek and succeed on video \'timeupdate\' event if seekable', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeUpdate";
    wrapper.setInitialTime(10);
    element.duration = 20;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.seekable.length = 1;
    spyOn(wrapper, "seek").andCallThrough();
    expect(element.currentTime).to.eql(null);
    $(element).triggerHandler("timeupdate");
    expect(element.currentTime).to.eql(10);
    expect(wrapper.seek.callCount).to.be(1);
    $(element).triggerHandler("timeupdate");
    expect(wrapper.seek.callCount).to.be(1);
  });

  it('should not raise timeUpdate before initial time is used', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeUpdate";
    OO.isAndroid = true;
    element.duration = 20;
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.seekable.length = 1;
    wrapper.setInitialTime(10);
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.TIME_UPDATE);
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.TIME_UPDATE);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.TIME_UPDATE);
  });

  it('should raise timeUpdate before initial time is used if the initial time position is passed', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeUpdate";
    spyOn(element.seekable, "start").andReturn(0);
    spyOn(element.seekable, "end").andReturn(20);
    element.duration = 20;
    element.seekable.length = 1;
    wrapper.setInitialTime(10);
    element.currentTime = 9;
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).not.to.eql(vtc.interface.EVENTS.TIME_UPDATE);
    element.currentTime = 11;
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.TIME_UPDATE);
  });

  // TODO: when async testing working, test for force end on timeupdate on m3u8

  it('should notify PLAY on video \'play\' event', function(){
    vtc.interface.EVENTS.PLAY = "play";
    element.src = "url";
    $(element).triggerHandler("play");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PLAY, { "url" : "url" }]);
  });

  it('should notify PAUSED on video \'pause\' event', function(){
    vtc.interface.EVENTS.PAUSED = "paused";
    $(element).triggerHandler("pause");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PAUSED]);
  });

  // TODO: when platform testing supported, test for forceEndOnPausedIfRequired

  it('should notify RATE_CHANGE on video \'ratechange\' event', function(){
    vtc.interface.EVENTS.RATE_CHANGE = "rateChange";
    $(element).triggerHandler("ratechange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.RATE_CHANGE]);
  });

  it('should notify VOLUME_CHANGE on video \'volumechange\' event', function(){
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumeChange";
    element.volume = 0.3;
    $(element).triggerHandler("volumechange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.3 }]);
  });

  it('should notify VOLUME_CHANGE on video \'volumechangeNew\' event', function(){
    vtc.notifyParameters = null;
    vtc.interface.EVENTS.VOLUME_CHANGE = "volumeChange";
    element.volume = 0.3;
    $(element).triggerHandler("volumechangeNew");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.3 }]);
  });

  it('should notify FULLSCREEN_CHANGED on video \'webkitbeginfullscreen\' event when paused', function(){
    vtc.interface.EVENTS.FULLSCREEN_CHANGED = "fullscreenChanged";
    $(element).triggerHandler({ type: "webkitbeginfullscreen",
                                target: { paused : true }
                              });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      { "isFullScreen": true,
         "paused": true
      }]);
  });

  it('should notify FULLSCREEN_CHANGED on video \'webkitbeginfullscreen\' event when not paused', function(){
    vtc.interface.EVENTS.FULLSCREEN_CHANGED = "fullscreenChanged";
    $(element).triggerHandler({ type: "webkitbeginfullscreen",
                                target: { paused : false }
                              });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      { "isFullScreen": true,
         "paused": false
      }]);
  });

  it('should notify FULLSCREEN_CHANGED on video \'webkitendfullscreen\' event when paused', function(){
    vtc.interface.EVENTS.FULLSCREEN_CHANGED = "fullscreenChanged";
    $(element).triggerHandler({ type: "webkitendfullscreen",
                                target: { paused : true }
                              });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      { "isFullScreen": false,
         "paused": true
      }]);
  });

  it('should notify FULLSCREEN_CHANGED on video \'webkitendfullscreen\' event when not paused', function(){
    vtc.interface.EVENTS.FULLSCREEN_CHANGED = "fullscreenChanged";
    $(element).triggerHandler({ type: "webkitendfullscreen",
                                target: { paused : false }
                              });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      { "isFullScreen": false,
         "paused": false
      }]);
  });

  it('should not notify on any events when the element is shared away', function(){
    vtc.notifyParameters = null;
    wrapper.sharedElementGive();
    $(element).triggerHandler({ type: "webkitendfullscreen" });
    expect(vtc.notifyParameters).to.be(null);
    $(element).triggerHandler({ type: "play" });
    expect(vtc.notifyParameters).to.be(null);
    $(element).triggerHandler({ type: "playing" });
    expect(vtc.notifyParameters).to.be(null);
    $(element).triggerHandler({ type: "seeking" });
    expect(vtc.notifyParameters).to.be(null);
    $(element).triggerHandler({ type: "ended" });
    expect(vtc.notifyParameters).to.be(null);
    $(element).triggerHandler({ type: "timeupdate" });
    expect(vtc.notifyParameters).to.be(null);
  });

  it('should notify on events when the shared element is returned', function(){
    vtc.notifyParameters = null;
    wrapper.sharedElementGive();
    $(element).triggerHandler({ type: "play" });
    expect(vtc.notifyParameters).to.be(null);
    wrapper.sharedElementTake();
    $(element).triggerHandler({ type: "webkitendfullscreen" });
    expect(vtc.notifyParameters).to.not.be(null);
    vtc.notifyParameters = null;
    $(element).triggerHandler({ type: "play" });
    expect(vtc.notifyParameters).to.not.be(null);
    vtc.notifyParameters = null;
    $(element).triggerHandler({ type: "playing" });
    expect(vtc.notifyParameters).to.not.be(null);
    vtc.notifyParameters = null;
    $(element).triggerHandler({ type: "seeked" });
    expect(vtc.notifyParameters).to.not.be(null);
    vtc.notifyParameters = null;
    $(element).triggerHandler({ type: "ended" });
    expect(vtc.notifyParameters).to.not.be(null);
    vtc.notifyParameters = null;
    $(element).triggerHandler({ type: "timeupdate" });
    expect(vtc.notifyParameters).to.not.be(null);
  });

  it('should not raise play events while priming', function(){
    vtc.interface.EVENTS.PLAY = "play";
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "play" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.PLAY);
    wrapper.play();
    $(element).triggerHandler({ type: "play" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.PLAY);
  });

  it('should not raise playing events while priming', function(){
    vtc.interface.EVENTS.PLAYING = "playing";
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "playing" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.PLAYING);
    wrapper.play();
    $(element).triggerHandler({ type: "playing" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.PLAYING);
  });

  it('should not raise pause events while priming', function(){
    vtc.interface.EVENTS.PAUSED = "paused";
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "pause" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.PAUSED);
    wrapper.play();
    $(element).triggerHandler({ type: "pause" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.PAUSED);
  });

  it('should not raise seek events while priming', function(){
    vtc.interface.EVENTS.SEEKING = "seeking";
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "seeking" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.SEEKING);
    wrapper.play();
    $(element).triggerHandler({ type: "seeking" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.SEEKING);
  });

  it('should not raise durationchange events while priming', function(){
    vtc.interface.EVENTS.DURATION_CHANGE = "duration";
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "durationchange" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.DURATION_CHANGE);
    wrapper.play();
    $(element).triggerHandler({ type: "durationchange" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.DURATION_CHANGE);
  });

  it('should not raise time update events while priming', function(){
    vtc.interface.EVENTS.TIME_UPDATE = "timeupdate";
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "timeupdate" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.TIME_UPDATE);
    wrapper.play();
    $(element).triggerHandler({ type: "timeupdate" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.TIME_UPDATE);
  });

  // TODO: Add tests for platform parsing when test framework supports
});
