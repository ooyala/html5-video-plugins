// Load test helpers
jest.dontMock('underscore');
jest.dontMock('jquery');

global.OO = { publicApi: {}, platform: 'MacIntel', os: {}, browser: { version:1, webkit:true }, TEST_TEST_TEST: true};
global.OO.getRandomString = function() { return Math.random().toString(36).substring(7); };

// The function setTimeout from jsdom is not working, this overwrites the function with the function defined by node
global.window.setTimeout = setTimeout;
global.window.setInterval = setInterval;
global.window.clearInterval = clearInterval;
global.navigator = window.navigator;
global.window.$ = require("jquery");
OO.$ = global.window.$;

global.expect = require('expect.js');

// a wrapper domparser simulating Mozilla DOMParser in the browser:
window.DOMParser = function() {};

require.requireActual("../html5-common/js/utils/InitModules/InitOOUnderscore.js");

Object.assign(window.DOMParser.prototype, {
  parseFromString: function(data, type) {
    return jsdom.jsdom(data, jsdom.level(3, 'core'));
  }
});

global._ = OO._;

// In a browser environment, all of the properties of "window" (like navigator) are in the global scope:
OO._.extend(global, window);


OO.CONSTANTS = {
  CLOSED_CAPTIONS: {
    SHOWING: "showing",
    HIDDEN: "hidden",
    DISABLED: "disabled"
  },
  SEEK_TO_END_LIMIT: 3
};

require.requireActual("../html5-common/js/utils/InitModules/InitOOHazmat.js");

jest.dontMock('./utils/mock_vtc.js');
require('./utils/mock_vtc.js');

window.HTMLMediaElement.prototype.load = () => { /* do nothing */ };
window.HTMLMediaElement.prototype.play = () => { /* do nothing */ };
window.HTMLMediaElement.prototype.pause = () => { /* do nothing */ };
window.HTMLMediaElement.prototype.addTextTrack = () => { /* do nothing */ };
var readOnlyMediaProperties = ["duration", "currentSrc", "textTracks", "seeking", "paused", "ended", "audioTracks", "src"];

readOnlyMediaProperties.forEach((prop) => {
  Object.defineProperty(HTMLMediaElement.prototype, prop, {
    writable: true,
    configurable: true
  });
});

var readOnlyVideoProperties = ["videoWidth", "videoHeight"];

readOnlyVideoProperties.forEach((prop) => {
  Object.defineProperty(HTMLVideoElement.prototype, prop, {
    writable: true,
    configurable: true
  });
});

// Simulate behavior in which appending a track element to the video element
// results in a TextTrack object being created and added to the video's
// textTracks property. This is not currently handled by jsdom out of the box.
jest.mock('../src/main/js/text_track/text_track_helper', () => {
  const TextTrackHelper = require.requireActual(
    '../src/main/js/text_track/text_track_helper'
  ).default;
  const textTrackHelperProto = TextTrackHelper.prototype;

  const originalAddTrack = textTrackHelperProto.addTrack;
  // Override the class' addTrack method in order automatically create TextTrack
  // objects when a Track element is created. The rest of the implementation is
  // not mocked
  Object.assign(textTrackHelperProto, {
    addTrack: function(trackData) {
      if (!this.video) {
        return;
      }
      // Execute original logic first
      originalAddTrack.apply(this, arguments);
      // Add TextTrack object matching provided properties
      if (!this.video.textTracks) {
        this.video.textTracks = [];
      }
      this.video.textTracks.push({
        id: trackData.id,
        language: trackData.srclang,
        label: trackData.label,
        kind: trackData.kind,
        mode: 'disabled'
      });
      // Trigger add track handler in order to fully simulate
      // browser behavior
      if (this.video.textTracks.onaddtrack) {
        this.video.textTracks.onaddtrack();
      }
    }
  });

  return TextTrackHelper;
});
