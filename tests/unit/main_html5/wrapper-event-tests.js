/*
 * https://github.com/Automattic/expect.js
 */

const sinon = require('sinon');

describe('main_html5 wrapper tests', function () {
  var pluginFactory, parentElement, wrapper, element, vtc;

  // Setup
  OO.Video = { plugin: function(plugin) { pluginFactory = plugin; } };

  if (!OO.log) {
    OO.log = function() {};
  }

  // Load file under test
  jest.dontMock('../../../src/main/js/main_html5');
  jest.dontMock('../../../src/main/js/text_track/text_track_map');
  require('../../../src/main/js/main_html5');

  var closedCaptions = {
    locale: { en: "English" },
    closed_captions_vtt: {
      en: {
        name: "English",
        url: "http://ooyala.com"
      }
    }
  };

  var stubSeekable = function(element, start, end) {
    var startSpy = sinon.stub(element.seekable, "start").callsFake(() => {return start});
    var endSpy = sinon.stub(element.seekable, "end").callsFake(() => {return end});
    element.seekable.length = 1;
    return {startSpy, endSpy};
  };

  beforeEach(function() {
    vtc = new mock_vtc();
    parentElement = $("<div>");
    wrapper = pluginFactory.create(parentElement, "test", vtc.interface, {});
    element = parentElement.children()[0];
    element.textTracks = [];
  });

  afterEach(function() {
    OO.isEdge = false;
    OO.isAndroid = false;
    OO.isIos = false;
    OO.isIE = false;
    OO.isIE11Plus = false;
    OO.isSafari = false;
    OO.isChrome = false;
    OO.isFirefox = false;
    if (wrapper) { wrapper.destroy(); }
  });

  // tests

  it('should not dequeue seek on \'loadedmetadata\' event if no seek enqueued', function(){
    const spy = sinon.spy(wrapper, "seek");
    $(element).triggerHandler("loadedmetadata");
    expect(spy.callCount).to.be(0);
  });

  it('should dequeue seek on \'loadedmetadata\' event', function(){
    element.duration = 10;
    wrapper.setInitialTime(10);
    const spy = sinon.spy(wrapper, "seek");
    stubSeekable(element, 0, 10);
    $(element).triggerHandler("loadedmetadata");
    expect(spy.callCount).to.be(1);
  });

  it('should clear queued seek on a successful dequeue seek', function(){
    element.duration = 60;
    wrapper.setInitialTime(10);
    const spy = sinon.spy(wrapper, "seek");
    stubSeekable(element, 0, 60);
    $(element).triggerHandler("loadedmetadata");
    expect(spy.callCount).to.be(1);
    $(element).triggerHandler("loadedmetadata");
    expect(spy.callCount).to.be(1);
  });

  it('should notify PROGRESS on \'progress\' event', function(){
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
    element.currentTime = 3;
    element.duration = 10;
    stubSeekable(element, 0, 10);
    element.buffered.length = 1;
    sinon.stub(element.buffered, "end").callsFake(() => {return 10});
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
    $(element).triggerHandler("error");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: -1}]);
    $(element).triggerHandler({ type:"error",  target: { error: { code: 2 }}});
    element.error = { code: 2};
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: 2}]);
    $(element).triggerHandler({ type:"error",  target: { error: null} });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: -1}]);
    $(element).triggerHandler({ type:"error",  target: { error: { code: 0 }}});
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ERROR, {errorcode: 0}]);
  });

  it('should not notify ERROR on video \'error\' event with code 4 and empty src', function(){
    $(element).attr("src", "");
    var target = element;
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
    $(element).attr("src", "null");
    var target = element;
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
    element.currentSrc = "url";
    $(element).triggerHandler({ type: "stalled", target: {currentTime : 0}});
    expect(vtc.notifyParameters.length).to.eql(2);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.STALLED, { url : "url"}]);
  });

  // TODO: Create test case for stalled on iPad once we have platform simulation

  it('should notify BUFFERED on video \'canPlayThrough\' event', function(){
    element.currentSrc = "url";
    $(element).triggerHandler("canplaythrough");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.BUFFERED, { url : "url" }]);
  });

  it('should notify PLAYING on video \'playing\' event', function(){
    $(element).triggerHandler("playing");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PLAYING]);
  });

  it('should notify PLAYING on play promise then if play promises are supported with playing event first', function(){
    var originalPlay = element.play;
    var playPromiseThen = null;
    var playCalled = 0;
    element.play = function() {
      playCalled++;
      return {
        then: function(callback) {
          playPromiseThen = callback;
        }
      };
    };
    wrapper.play();
    expect(playCalled).to.be(1);

    //check that we ignore the playing event
    $(element).triggerHandler("playing");
    expect(_.contains(vtc.notifyParameters, vtc.interface.EVENTS.PLAYING)).to.eql(false);

    playPromiseThen();
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PLAYING]);
    element.play = originalPlay;
  });

  it('should notify PLAYING on play promise then if play promises are supported with play promise then first', function(){
    var originalPlay = element.play;
    var playPromiseThen = null;
    var playCalled = 0;
    element.play = function() {
      playCalled++;
      return {
        then: function(callback) {
          playPromiseThen = callback;
        }
      };
    };
    wrapper.play();
    expect(playCalled).to.be(1);

    playPromiseThen();
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PLAYING]);

    vtc.notifyParameters = [];
    //check that we ignore the playing event
    $(element).triggerHandler("playing");
    expect(vtc.notifyParameters).to.eql([]);

    element.play = originalPlay;
  });

  it('should notify PLAYING on video \'playing\' event if play promises are supported but playback started from something other than the video play API', function(){
    var originalPlay = element.play;
    var playPromiseThen = null;
    var playCalled = 0;
    element.play = function() {
      playCalled++;
      return {
        then: function(callback) {
          playPromiseThen = callback;
        }
      };
    };

    $(element).triggerHandler("playing");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PLAYING]);

    element.play = originalPlay;
  });

  it('should notify ASSET_DIMENSION on first \'canPlay\' event', function(){
    var videoDimensions = {width: 640, height: 480};
    element.videoWidth = videoDimensions.width;
    element.videoHeight = videoDimensions.height;
    $(element).triggerHandler("canplay");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ASSET_DIMENSION, videoDimensions]);
  });

  it('should notify MULTI_AUDIO_AVAILABLE on first \'canPlay\' event', function(){
    wrapper.getAvailableAudio = function() {
      return [{
        'id': 1,
        'label': 'eng',
        'lang': 'eng',
        'enabled': true
      }, {
        'id': 2,
        'label': 'ger',
        'lang': 'ger',
        enabled: false
      }];
    };
    $(element).triggerHandler('canplay');
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.MULTI_AUDIO_AVAILABLE);
  });

  it('should not notify MULTI_AUDIO_AVAILABLE on first \'canPlay\' event when getAvailableAudio returns too short array', function(){
    wrapper.getAvailableAudio = function() {
      return [{'id': 1}];
    };
    $(element).triggerHandler('canplay');
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.MULTI_AUDIO_AVAILABLE);
  });

  it('should notify MULTI_AUDIO_CHANGED after setAudio', function() {
    element.audioTracks = [];
    element.audioTracks[0] = { id: 0, language: 'en', label: '', enabled: true };
    element.audioTracks[1] = { id: 1, language: 'en', label: '', enabled: false };

    element.audioTracks.__proto__ = {
      getTrackById: vtc.getTrackById
    };

    wrapper.setAudio(1);
    wrapper.setAudio(1);
    wrapper.setAudio(1);
    wrapper.setAudio(1);
    wrapper.setAudio(1);
    wrapper.setAudio(1);
    wrapper.setAudio(1);
    wrapper.setAudio(1);
    wrapper.setAudio(1);

    var callCount = vtc.notified.reduce(function (accumulator, event) {
      return event === vtc.interface.EVENTS.MULTI_AUDIO_CHANGED ?
        accumulator = accumulator + 1 :
        accumulator;
    }, 0);

    expect(callCount).to.be(1);
  });

  it('should reset audio tracks when switching streams and allow for MULTI_AUDIO_CHANGED to get fired when audio is set with same available audio as first stream', function () {
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    //language already set to German on canPlay
    wrapper.getAvailableAudio = function() {
      return [{
        'id': 1,
        'label': 'eng',
        'lang': 'eng',
        'enabled': false
      }, {
        'id': 2,
        'label': 'ger',
        'lang': 'ger',
        enabled: true
      }];
    };
    $(element).triggerHandler('canplay');
    expect(wrapper.audioTracks).to.eql([{
      'id': 1,
      'label': 'eng',
      'lang': 'eng',
      'enabled': false
    }, {
      'id': 2,
      'label': 'ger',
      'lang': 'ger',
      enabled: true
    }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.MULTI_AUDIO_AVAILABLE)).to.eql(true);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.MULTI_AUDIO_CHANGED)).to.eql(false);

    //attempt to set to German again, but no MULTI_AUDIO_CHANGED will be published
    wrapper.setAudio(1);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.MULTI_AUDIO_CHANGED)).to.eql(false);

    //next stream defaults to English
    vtc.notified = [];
    vtc.notifyParameters = [];

    wrapper.setVideoUrl("url2", OO.VIDEO.ENCODING.HLS);
    wrapper.getAvailableAudio = function() {
      return [{
        'id': 1,
        'label': 'eng',
        'lang': 'eng',
        'enabled': true
      }, {
        'id': 2,
        'label': 'ger',
        'lang': 'ger',
        enabled: false
      }];
    };
    $(element).triggerHandler('canplay');
    expect(wrapper.audioTracks).to.eql([{
      'id': 1,
      'label': 'eng',
      'lang': 'eng',
      'enabled': true
    }, {
      'id': 2,
      'label': 'ger',
      'lang': 'ger',
      enabled: false
    }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.MULTI_AUDIO_AVAILABLE)).to.eql(true);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.MULTI_AUDIO_CHANGED)).to.eql(false);

    //set audio to German again
    wrapper.getAvailableAudio = function() {
      return [{
        'id': 1,
        'label': 'eng',
        'lang': 'eng',
        'enabled': false
      }, {
        'id': 2,
        'label': 'ger',
        'lang': 'ger',
        enabled: true
      }];
    };

    wrapper.setAudio(2);
    expect(wrapper.audioTracks).to.eql([{
      'id': 1,
      'label': 'eng',
      'lang': 'eng',
      'enabled': false
    }, {
      'id': 2,
      'label': 'ger',
      'lang': 'ger',
      enabled: true
    }]);
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.MULTI_AUDIO_CHANGED)).to.eql(true);
  });

  it('should notify CAPTIONS_FOUND_ON_PLAYING on \'onaddtrack\' event if video has cc', function() {
    element.textTracks = [{ kind: "captions" }];
    $(element).triggerHandler("loadedmetadata");
    element.textTracks.onaddtrack();
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['CC1'],
      locale: {
        CC1: 'Captions (CC1)'
      }
    }]);
  });

  it('should notify CAPTIONS_FOUND_ON_PLAYING on \'onaddtrack\' event for both internal and external CCs', function(){
    element.textTracks = [{ language: "", label: "", kind: "subtitles" }]; // this is internal CC
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions("en", closedCaptions, { mode: "hidden" }); // creates text tracks for external CCs
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['en', 'CC1'],
      locale: {
        en: 'English',
        CC1: 'Captions (CC1)'
      }
    }]);
  });

  it('should ignore metadata tracks when notifying CAPTIONS_FOUND_ON_PLAYING', function(){
    element.textTracks = [
      { language: "en", label: "", kind: "subtitles" },
      { language: "es", label: "", kind: "metadata" }
    ];
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    element.textTracks.onaddtrack();
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['CC1'],
      locale: {
        CC1: 'en',
      }
    }]);
  });

  it('should not notify DURATION_CHANGE or PROGRESS during failover', function(){
    vtc.notifyParameters = [];
    wrapper.handleFailover(100);
    $(element).triggerHandler("duration");
    expect(vtc.notifyParameters).to.eql([]);
    $(element).triggerHandler("progress");
    expect(vtc.notifyParameters).to.eql([]);
  });

  it('should seek to saved dvr position after play during failover', function(){
    var savedPlayhead = 100;
    const spy = sinon.spy(wrapper, "seek");
    var originalPlay = element.play;
    var playPromiseThen = null;
    var playCalled = 0;
    element.play = function() {
      playCalled++;
      return {
        then: function(callback) {
          playPromiseThen = callback;
        }
      };
    };
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    wrapper.handleFailover(savedPlayhead);
    wrapper.play();
    expect(playCalled).to.be(1);
    stubSeekable(element, 0, savedPlayhead * 2);
    playPromiseThen();
	expect(spy.callCount).to.be(1);
	expect(spy.calledWith(savedPlayhead)).to.be(true);
    expect(element.currentTime).to.eql(100);
    element.play = originalPlay;
  });

  it('should notify CAPTIONS_FOUND_ON_PLAYING with multiple in-manifest/in-stream captions', function() {
    element.textTracks = [
      { language: "", label: "", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" }
    ];
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions("en", closedCaptions, { mode: "hidden" });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['en', 'CC1', 'CC2', 'CC3'],
      locale: {
        en: 'English',
        CC1: 'Captions (CC1)',
        CC2: 'Captions (CC2)',
        CC3: 'Captions (CC3)'
      }
    }]);
  });

  it('should notify CAPTIONS_FOUND_ON_PLAYING giving priority to external tracks that have the same language as in-manifest/in-stream tracks', function() {
    element.textTracks = [
      { language: "en", label: "Internal EN", kind: "subtitles" },
      { language: "es", label: "Internal ES", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" }
    ];
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions("en", closedCaptions, { mode: "hidden" });
    // Only one english track is reported, internal tracks that don't collide
    // with external are also reported
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['en', 'CC2', 'CC3'],
      locale: {
        en: 'English',
        CC2: 'Internal ES',
        CC3: 'Captions (CC3)'
      }
    }]);
  });

  it('should notify CAPTIONS_FOUND_ON_PLAYING with multiple in-manifest/in-stream captions using label and language metadata when available', function() {
    element.textTracks = [
      { language: "", label: "", kind: "subtitles" },
      { language: "es", label: "", kind: "subtitles" },
      { language: "de", label: "German", kind: "subtitles" }
    ];
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions("en", closedCaptions, { mode: "hidden" });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['en', 'CC1', 'CC2', 'CC3'],
      locale: {
        en: 'English',
        CC1: 'Captions (CC1)',
        CC2: 'es',
        CC3: 'German'
      }
    }]);
  });

  it('should reset in-manifest/in-stream track ids when a new source is set', function() {
    element.textTracks = [
      { language: "", label: "", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" },
    ];
    wrapper.setVideoUrl("url1", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    element.textTracks.onaddtrack();
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['CC1', 'CC2'],
      locale: {
        CC1: 'Captions (CC1)',
        CC2: 'Captions (CC2)',
      }
    }]);
    // Tracks should start from 1 once more instead of CC3, CC4...
    element.textTracks = [
      { language: "", label: "", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" },
    ];
    wrapper.setVideoUrl("url2", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    element.textTracks.onaddtrack();
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['CC1', 'CC2'],
      locale: {
        CC1: 'Captions (CC1)',
        CC2: 'Captions (CC2)',
      }
    }]);
  });

  it('should NOT re-add manually added tracks to available captions when in-manifest/in-stream tracks are checked', function() {
    element.textTracks = [
      { language: "", label: "", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" },
      { language: "", label: "", kind: "subtitles" }
    ];
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions("en", closedCaptions, { mode: "hidden" });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CAPTIONS_FOUND_ON_PLAYING, {
      languages: ['en', 'CC1', 'CC2', 'CC3'],
      locale: {
        en: 'English',
        CC1: 'Captions (CC1)',
        CC2: 'Captions (CC2)',
        CC3: 'Captions (CC3)'
      }
    }]);
  });

  it('should notify CLOSED_CAPTION_CUE_CHANGED from onClosedCaptionCueChange event on textTrack', function(){
    var event = {
      currentTarget: {
        activeCues: [{
          text: "This is cue text."
        }]
      }
    };
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions("en", closedCaptions, {mode: "hidden"});
    element.textTracks[0].oncuechange(event);
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CLOSED_CAPTION_CUE_CHANGED, event.currentTarget.activeCues[0].text]);
  });

  it('should notify CLOSED_CAPTION_CUE_CHANGED from onClosedCaptionCueChange event on textTrack with all active cues', function(){
    var event = {
      currentTarget: {
        activeCues: [{
          text: "This is cue text."
        }, {
          text: "This is more text."
        }]
      }
    };
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("loadedmetadata");
    $(element).triggerHandler("canplay");
    wrapper.setClosedCaptions("en", closedCaptions, {mode: "hidden"});
    element.textTracks[0].oncuechange(event);
    expect(vtc.notifyParameters).to.eql([
      vtc.interface.EVENTS.CLOSED_CAPTION_CUE_CHANGED,
      event.currentTarget.activeCues[0].text + "\n" + event.currentTarget.activeCues[1].text
    ]);
  });

  it('should notify CLOSED_CAPTION_CUE_CHANGED from setClosedCaptionsMode if mode is disabled', function(){
    wrapper.setClosedCaptionsMode("disabled");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.CLOSED_CAPTION_CUE_CHANGED, ""]);
  });

  it('should notify WAITING on video \'waiting\' event', function(){
    element.currentSrc = "url";
    $(element).triggerHandler("waiting");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.WAITING, { url : "url" }]);
  });

  it('should not notify WAITING on video \'waiting\' event if source is null', function(){
    element.currentSrc = "";
    $(element).triggerHandler("waiting");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.WAITING)).to.be(false);
  });

  it('should notify SEEKING on video \'seeking\' event', function(){
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.SEEKING]);
  });

  it('should not raise seeking before initial time has seeked', function(){
    element.duration = 20;
    stubSeekable(element, 0, 20);
    wrapper.setInitialTime(10);
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.SEEKING);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.SEEKING);
  });

  it('should not raise seeking before initial time has seeked if initialtime is 0', function(){
    element.duration = 20;
    stubSeekable(element, 0, 20);
    wrapper.play();
    $(element).triggerHandler("playing");
    wrapper.setInitialTime(0);
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.SEEKING);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("seeking");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.SEEKING);
  });

  it('should dequeue play command if seeking completed', function(){
    element.seeking = true;
    var originalPlay = element.play;
    var playPromiseThen = null;
    var playCalled = 0;
    element.play = function() {
      playCalled++;
      return {
        then: function(callback) {
          playPromiseThen = callback;
        }
      };
    };
    wrapper.play();
    element.seeking = false;
    $(element).triggerHandler("seeked");
    expect(playCalled).to.be(1);
    playPromiseThen();
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.PLAYING);
    element.play = originalPlay;
  });

  it('should not dequeue play command if stream paused before seeking completed', function(){
    element.seeking = true;
    const spy = sinon.spy(element, "play");
    wrapper.play();
    wrapper.pause();
    element.seeking = false;
    $(element).triggerHandler("seeked");
    expect(spy.callCount).to.be(0);
  });

  it('should notify SEEKED on video \'seeked\' event', function(){
    $(element).triggerHandler("seeked");
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.SEEKED);
  });

  it('should not raise seeked when initial time is set to non-zero', function(){
    element.duration = 20;
    stubSeekable(element, 0, 20);
    wrapper.setInitialTime(10);
    $(element).triggerHandler("seeked");
    expect(vtc.notified[0]).to.not.eql(vtc.interface.EVENTS.SEEKED);
    $(element).triggerHandler("seeked");
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.SEEKED);
  });

  it('should not raise seeked before initial time has seeked if initialtime is 0', function(){
    element.duration = 20;
    stubSeekable(element, 0, 20);
    wrapper.play();
    $(element).triggerHandler("playing");
    wrapper.setInitialTime(0);
    $(element).triggerHandler("seeked");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.SEEKED)).to.eql(false);
    $(element).triggerHandler("seeked");
    expect(_.contains(vtc.notified, vtc.interface.EVENTS.SEEKED)).to.eql(true);
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
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
  });

  it('should only raise ended event once per stream', function(){
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
    vtc.notifyParameters = null;
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql(null);
    $(element).triggerHandler("loadstart");
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
  });

  it('should not raise ended event when video source is cleared', function(){
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.ENDED]);
    vtc.notifyParameters = null;
    wrapper.setVideoUrl("", OO.VIDEO.ENCODING.HLS);
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters).to.be(null);
  });

  // TODO: When we have platform testing support, test for iOS behavior for ended event raised when ended != true

  it('should block seekable from playheads until video initialization in safari', function(){
    OO.isSafari = true;
    element.currentTime = 3;
    element.duration = 10;
    var spies = stubSeekable(element, 2, 10);
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "currentLiveTime" : 0,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);
    expect(spies.startSpy.callCount).to.be(0);
    expect(spies.endSpy.callCount).to.be(0);

    $(element).triggerHandler("canplay");
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "currentLiveTime" : 0,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 2, "end" : 10}
      }]);
    expect(spies.startSpy.callCount).to.be(1);
    expect(spies.endSpy.callCount).to.be(1);
  });

  it('should reblock seekable from playheads upon load until video initialization in safari', function(){
    OO.isSafari = true;
    element.currentTime = 3;
    element.duration = 10;
    var spies = stubSeekable(element, 2, 10);

    $(element).triggerHandler("canplay");
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "currentLiveTime" : 0,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 2, "end" : 10}
      }]);
    expect(spies.startSpy.callCount).to.be(1);
    expect(spies.endSpy.callCount).to.be(1);

    spies.startSpy.reset();
    spies.endSpy.reset();
    wrapper.load();
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "currentLiveTime" : 0,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);
    expect(spies.startSpy.callCount).to.be(0);
    expect(spies.endSpy.callCount).to.be(0);
  });

  it('should notify DURATION_CHANGE on video \'durationchange\' event', function(){
    element.currentTime = 3;
    element.duration = 10;
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "currentLiveTime" : 0,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);
  });

  it('should notify DURATION_CHANGE on video \'durationchange\' event with buffer range and seek range', function(){
    element.currentTime = 3;
    element.duration = 10;
    stubSeekable(element, 0, 10);
    sinon.stub(element.buffered, "end").callsFake(() => {return 10});
    element.buffered.length = 1;
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.DURATION_CHANGE,
      {
        "currentTime" : 3,
        "currentLiveTime" : 0,
        "duration" : 10,
        "buffer" : 10,
        "seekRange" : {"start": 0, "end" : 10}
      }]);
  });

  it('should not raise durationChange before initial time is used', function(){
    element.duration = 20;
    stubSeekable(element, 0, 20);
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

  it('should not raise durationChange before initial time is used for a queued seek', function(){
    OO.isAndroid = true;
    element.duration = 20;
    stubSeekable(element, 0, 20);
    wrapper.setInitialTime(10);
    element.currentTime = 9;
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.DURATION_CHANGE);
    //timeupdate will dequeue the seek
    $(element).triggerHandler("timeupdate");
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.DURATION_CHANGE);
  });

  it('should raise durationchange before initial time is used if the initial time position is passed', function(){
    OO.isAndroid = true;
    stubSeekable(element, 0, 20);
    element.duration = 20;
    element.currentTime = 11;
    wrapper.setInitialTime(10);
    $(element).triggerHandler("timeupdate");
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("durationchange");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.DURATION_CHANGE);
  });

  it('should notify TIME_UPDATE on video \'timeupdate\' event', function(){
    element.currentTime = 3;
    element.duration = 10;
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE,
      {
        "currentTime" : 3,
        "currentLiveTime" : 0,
        "duration" : 10,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
      }]);
  });

  it('should notify TIME_UPDATE on video \'timeupdate\' event with buffer range and seek range', function(){
    element.currentTime = 3;
    element.duration = 10;
    stubSeekable(element, 0, 10);
    sinon.stub(element.buffered, "end").callsFake(() => {return 10});
    element.buffered.length = 1;
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE,
      {
        "currentTime" : 3,
        "currentLiveTime" : 0,
        "duration" : 10,
        "buffer" : 10,
        "seekRange" : {"start": 0, "end" : 10}
      }]);
  });

  it('should not notify TIME_UPDATE on video \'timeupdate\' event if seeking', function(){
    element.currentTime = 3;
    element.duration = 10;
    $(element).triggerHandler("seeking");
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).to.not.eql(vtc.interface.EVENTS.TIME_UPDATE);
  });

  it('should dequeue seek and fail on video \'timeupdate\' event if not seekable', function(){
    element.duration = 10;
    wrapper.setInitialTime(10);
    const spy = sinon.spy(wrapper, "seek");
    $(element).triggerHandler("timeupdate");
    expect(spy.callCount).to.be(1);
    $(element).triggerHandler("timeupdate");
    expect(spy.callCount).to.be(2);
    expect(element.currentTime).to.eql(0);
  });

  it('should dequeue seek and succeed on video \'timeupdate\' event if seekable', function(){
    element.duration = 20;
    wrapper.setInitialTime(10);
    stubSeekable(element, 0, 20);
    element.seekable.length = 1;
    const spy = sinon.spy(wrapper, "seek");
    expect(element.currentTime).to.eql(0);
    $(element).triggerHandler("timeupdate");
    expect(element.currentTime).to.eql(10);
    expect(spy.callCount).to.be(1);
    $(element).triggerHandler("timeupdate");
    expect(spy.callCount).to.be(1);
  });

  it('should not raise timeUpdate before initial time is used', function(){
    OO.isAndroid = true;
    element.duration = 20;
    stubSeekable(element, 0, 20);
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
    stubSeekable(element, 0, 20);
    element.duration = 20;
    element.seekable.length = 1;
    wrapper.setInitialTime(10);
    element.currentTime = 9;
    $(element).triggerHandler("seeked");
    expect(vtc.notifyParameters[0]).not.to.eql(vtc.interface.EVENTS.TIME_UPDATE);
    element.currentTime = 10;
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.TIME_UPDATE);
  });

  it('should raise timeUpdate on times before initial time if initial time has been reached previously', function(){
    stubSeekable(element, 0, 20);
    element.duration = 20;
    element.seekable.length = 1;
    wrapper.setInitialTime(10);
    element.currentTime = 10;
    $(element).triggerHandler("seeked");
    expect(vtc.notifyParameters[0]).not.to.eql(vtc.interface.EVENTS.TIME_UPDATE);
    element.currentTime = 9;
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.TIME_UPDATE);
  });

  it('should raise timeUpdate on replay if initial time is more than video duration', function(){
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
    element.duration = 20;
    wrapper.setInitialTime(40);
    wrapper.play();
    $(element).triggerHandler("ended");
    expect(vtc.notifyParameters[0]).to.eql(vtc.interface.EVENTS.ENDED);
    element.currentTime = 10;
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE,
    {
        "currentTime" : 10,
        "currentLiveTime" : 0,
        "duration" : 20,
        "buffer" : 0,
        "seekRange" : {"start": 0, "end" : 0}
    }]);
  });

  it('DVR: Should use initial time when seek ranges are available on time update event', () => {
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    let initialTime = 10;
    element.duration = 20;
    wrapper.setInitialTime(initialTime);
    wrapper.play();

    element.currentTime = 0;
    $(element).triggerHandler("timeupdate");
    expect(element.currentTime).to.eql(0);

    element.currentTime = 1;
    $(element).triggerHandler("timeupdate");
    expect(element.currentTime).to.eql(1);

    stubSeekable(element, 0, 20);
    element.seekable.length = 1;
    element.currentTime = 2;
    $(element).triggerHandler("timeupdate");
    expect(element.currentTime).to.eql(initialTime);
  });

  it('DVR: Should use initial time when seek ranges are available on progress event', () => {
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    let initialTime = 10;
    element.duration = 20;
    wrapper.setInitialTime(initialTime);
    wrapper.play();

    element.currentTime = 0;
    $(element).triggerHandler("progress");
    $(element).triggerHandler("timeupdate");
    expect(element.currentTime).to.eql(0);

    element.currentTime = 1;
    $(element).triggerHandler("progress");
    $(element).triggerHandler("timeupdate");
    expect(element.currentTime).to.eql(1);

    stubSeekable(element, 0, 20);
    element.seekable.length = 1;
    $(element).triggerHandler("progress");
    expect(element.currentTime).to.eql(initialTime);
  });

  it('DVR: should notify TIME_UPDATE on video \'timeupdate\' event with DVR-formatted values', function() {
    var dvrWindowSize = 2000;
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    element.currentTime = dvrWindowSize;
    element.duration = Infinity;
    element.seekable.length = 1;
    element.buffered.length = 1;
    stubSeekable(element, 0, dvrWindowSize);
    sinon.stub(element.buffered, "end").callsFake(() => {return 10});
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE, {
      currentTime: dvrWindowSize,
      currentLiveTime: element.currentTime,
      duration: dvrWindowSize,
      buffer: dvrWindowSize,
      seekRange: { start: 0, end: dvrWindowSize }
    }]);
  });

  it('DVR: should apply time shift to currentTime and report video.currentTime as currentLiveTime when notifying TIME_UPDATE', function() {
    var dvrWindowStart = 100;
    var dvrWindowSize = 1400;
    var dvrWindowEnd = dvrWindowStart + dvrWindowSize;
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    element.currentTime = dvrWindowEnd;
    element.duration = Infinity;
    element.seekable.length = 1;
    element.buffered.length = 1;
    stubSeekable(element, dvrWindowStart, dvrWindowEnd);
    sinon.stub(element.buffered, "end").callsFake(() => {return 10});
    wrapper.seek(700);
    $(element).triggerHandler("seeked");
    $(element).triggerHandler("timeupdate");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.TIME_UPDATE, {
      currentTime: 700,
      currentLiveTime: element.currentTime,
      duration: dvrWindowSize,
      buffer: dvrWindowSize,
      seekRange: {
        start: dvrWindowStart,
        end: dvrWindowEnd
      }
    }]);
  });

  it('DVR: should set duration and buffer to the size of the DVR window when notifying TIME_UPDATE', function() {
    var dvrWindowStart = 1000;
    var dvrWindowSize = 1750;
    var dvrWindowEnd = dvrWindowStart + dvrWindowSize;
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS, true);
    element.currentTime = 2700;
    element.duration = Infinity;
    element.seekable.length = 1;
    element.buffered.length = 1;
    stubSeekable(element, dvrWindowStart, dvrWindowEnd);
    sinon.stub(element.buffered, "end").callsFake(() => {return 100});
    $(element).triggerHandler("timeupdate");
    var params = vtc.notifyParameters[1];
    expect(params.duration).to.be(dvrWindowSize);
    expect(params.buffer).to.be(dvrWindowSize);
  });

  // TODO: when async testing working, test for force end on timeupdate on m3u8

  it('should notify PLAY on video \'play\' event', function(){
    element.src = "url";
    $(element).triggerHandler("play");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PLAY, { "url" : "url" }]);
  });

  it('should notify PAUSED on video \'pause\' event', function(){
    $(element).triggerHandler("pause");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PAUSED]);
  });

  // TODO: when platform testing supported, test for forceEndOnPausedIfRequired

  it('should notify PLAYBACK_RATE_CHANGE on video \'ratechange\' event', function() {
    element.playbackRate = 2;
    $(element).triggerHandler("ratechange");
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.PLAYBACK_RATE_CHANGE, {
      playbackRate: 2
    }]);
  });

  it('wrapper should fire MUTE_STATE_CHANGE events on player\'s \'onMuted\' and \'onUnmuted\' event callback when muted', function(){
    vtc.notifyParametersHistory = [];
    vtc.notified = [];

    element.muted = true;
    $(element).triggerHandler({
      type: "volumechange",
      target: {volume: 0.3}
    });
    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.MUTE_STATE_CHANGE);
    expect(vtc.notifyParametersHistory[1][1]).to.eql({muted: true});
  });

  it('wrapper should fire MUTE_STATE_CHANGE events on player\'s \'onMuted\' and \'onUnmuted\' event callback when not muted', function(){
    vtc.notifyParametersHistory = [];
    vtc.notified = [];

    element.muted = false;
    element.volume = 0.3;
    var event = document.createEvent('HTMLEvents');
    event.initEvent('volumechange');
    element.dispatchEvent(event);

    expect(vtc.notified[1]).to.eql(vtc.interface.EVENTS.MUTE_STATE_CHANGE);
    expect(vtc.notifyParametersHistory[1][1]).to.eql({muted: false});
  });

  it('should notify VOLUME_CHANGE on video \'volumechange\' event', function(){
    vtc.notifyParametersHistory = [];
    element.volume = 0.3;
    var event = document.createEvent('HTMLEvents');
    event.initEvent('volumechange');
    element.dispatchEvent(event);
    expect(vtc.notifyParametersHistory[0]).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.3 }]);
  });

  //TODO: Our unit test DOM engine is behaving strangely in that when muted, the volume change event is published
  //but with a volume of undefined. In a real browser, this is working fine.
  //For now, this will have to be manually tested

  //it('should notify VOLUME_CHANGE on video \'volumechange\' event if video is muted', function(){
  //  vtc.notifyParametersHistory = [];
  //  element.muted = true;
  //  $(element).triggerHandler({
  //    type: "volumechange",
  //    target: {volume: 0.3}
  //  });
  //  expect(vtc.notifyParametersHistory[0]).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.3 }]);
  //  expect(vtc.notifyParametersHistory[1]).to.eql([vtc.interface.EVENTS.MUTE_STATE_CHANGE, { muted: true }]);
  //});

  it('should notify VOLUME_CHANGE on setting video volume', function(){
    vtc.notifyParametersHistory = [];
    element.volume = 0.3;
    expect(vtc.notifyParametersHistory[0]).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.3 }]);
  });

  //TODO: Our unit test DOM engine is behaving strangely in that when muted, the volume change event is published
  //but with a volume of undefined. In a real browser, this is working fine.
  //For now, this will have to be manually tested

  //it('should notify VOLUME_CHANGE on setting video volume if video is muted', function(){
  //  vtc.interface.EVENTS.VOLUME_CHANGE = "volumeChange";
  //  vtc.notifyParametersHistory = [];
  //  element.muted = true;
  //  element.volume = 0.3;
  //  expect(vtc.notifyParametersHistory[0]).to.eql([vtc.interface.EVENTS.VOLUME_CHANGE, { volume: 0.3 }]);
  //  expect(vtc.notifyParametersHistory[1]).to.eql([vtc.interface.EVENTS.MUTE_STATE_CHANGE, { muted: true }]);
  //});

  it('should notify FULLSCREEN_CHANGED on video \'webkitbeginfullscreen\' event when paused', function(){
    $(element).triggerHandler({ type: "webkitbeginfullscreen",
                                target: { paused : true }
                              });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      { "isFullScreen": true,
         "paused": true
      }]);
  });

  it('should notify FULLSCREEN_CHANGED on video \'webkitbeginfullscreen\' event when not paused', function(){
    $(element).triggerHandler({ type: "webkitbeginfullscreen",
                                target: { paused : false }
                              });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      { "isFullScreen": true,
         "paused": false
      }]);
  });

  it('should notify FULLSCREEN_CHANGED on video \'webkitendfullscreen\' event when paused', function(){
    $(element).triggerHandler({ type: "webkitendfullscreen",
                                target: { paused : true }
                              });
    expect(vtc.notifyParameters).to.eql([vtc.interface.EVENTS.FULLSCREEN_CHANGED,
      { "isFullScreen": false,
         "paused": true
      }]);
  });

  it('should notify FULLSCREEN_CHANGED on video \'webkitendfullscreen\' event when not paused', function(){
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
    wrapper.setVideoUrl("url", OO.VIDEO.ENCODING.HLS);
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
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "play" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.PLAY);
    wrapper.play();
    $(element).triggerHandler({ type: "play" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.PLAY);
  });

  it('should not raise playing events while priming', function(){
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "playing" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.PLAYING);
    wrapper.play();
    $(element).triggerHandler({ type: "playing" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.PLAYING);
  });

  it('should not raise pause events while priming', function(){
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "pause" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.PAUSED);
    wrapper.play();
    $(element).triggerHandler({ type: "pause" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.PAUSED);
  });

  it('should not raise seek events while priming', function(){
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "seeking" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.SEEKING);
    wrapper.play();
    $(element).triggerHandler({ type: "seeking" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.SEEKING);
  });

  it('should not raise durationchange events while priming', function(){
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "durationchange" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.DURATION_CHANGE);
    wrapper.play();
    $(element).triggerHandler({ type: "durationchange" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.DURATION_CHANGE);
  });

  it('should not raise time update events while priming', function(){
    wrapper.primeVideoElement();
    $(element).triggerHandler({ type: "timeupdate" });
    expect(vtc.notified[vtc.notified.length - 1]).to.not.eql(vtc.interface.EVENTS.TIME_UPDATE);
    wrapper.play();
    $(element).triggerHandler({ type: "timeupdate" });
    expect(vtc.notified[vtc.notified.length - 1]).to.eql(vtc.interface.EVENTS.TIME_UPDATE);
  });

  // TODO: Add tests for platform parsing when test framework supports
});
