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

OO._.extend(window.DOMParser.prototype, {
  parseFromString: function(data, type) {
    return jsdom.jsdom(data, jsdom.level(3, 'core'));
  }
});

global._ = OO._;

// In a browser environment, all of the properties of "window" (like navigator) are in the global scope:
OO._.extend(global, window);

require.requireActual("../html5-common/js/utils/InitModules/InitOOHazmat.js");

jest.dontMock('./utils/mock_vtc.js');
require('./utils/mock_vtc.js');

window.HTMLMediaElement.prototype.load = () => { /* do nothing */ };
window.HTMLMediaElement.prototype.play = () => { /* do nothing */ };
window.HTMLMediaElement.prototype.pause = () => { /* do nothing */ };
window.HTMLMediaElement.prototype.addTextTrack = () => { /* do nothing */ };
var readOnlyMediaProperties = ["duration", "currentSrc", "textTracks", "seeking", "paused", "ended", "audioTracks", "src"];

_.each(readOnlyMediaProperties, (prop) => {
  Object.defineProperty(HTMLMediaElement.prototype, prop, {
    writable: true,
    configurable: true
  });
});

var readOnlyVideoProperties = ["videoWidth", "videoHeight"];

_.each(readOnlyVideoProperties, (prop) => {
  Object.defineProperty(HTMLVideoElement.prototype, prop, {
    writable: true,
    configurable: true
  });
});