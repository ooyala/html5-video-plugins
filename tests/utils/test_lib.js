jest.dontMock('underscore');
jest.dontMock('jquery');

global.OO = { publicApi: {}, platform: 'MacIntel', os: {}, browser: { version:1, webkit:true }, TEST_TEST_TEST: true};

// The function setTimeout from jsdom is not working, this overwrites the function with the function defined by node
global.window.setTimeout = setTimeout;
global.window.setInterval = setInterval;
global.window.clearInterval = clearInterval;
global.navigator = window.navigator;

global.expect = require('expect.js');

// a wrapper domparser simulating Mozilla DOMParser in the browser:
window.DOMParser = function() {};

require.requireActual("../../html5-common/js/utils/InitModules/InitOOUnderscore.js");

OO._.extend(window.DOMParser.prototype, {
  parseFromString: function(data, type) {
    return jsdom.jsdom(data, jsdom.level(3, 'core'));
  }
});

// In a browser environment, all of the properties of "window" (like navigator) are in the global scope:
OO._.extend(global, window);

// This needs to come after the extend(global, window) line above otherwise $ gets set to undefined.
require.requireActual("../../html5-common/js/utils/InitModules/InitOOJQuery.js");
require.requireActual("../../html5-common/js/utils/InitModules/InitOOHazmat.js");
