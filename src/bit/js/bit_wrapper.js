/*
 * Plugin for bitdash player by Bitmovin GMBH
 */

require("../../../html5-common/js/utils/InitModules/InitOO.js");
require("../../../html5-common/js/utils/InitModules/InitOOUnderscore.js");
require("../../../html5-common/js/utils/constants.js");

(function(_, $) {
  var pluginName = "bitdash";
  var currentInstances = 0;
  var bitdashLibLoaded = false;
  var bitdashLibURL;
  var BITDASH_LIB_TIMEOUT = 30000;
  var licenseKeyURL = "//dev.corp.ooyala.com:8000/bitdash_settings.js";
  var filename = "bit_wrapper.*\.js";

  var licenseKeyJs = document.createElement("script");
  licenseKeyJs.type = "text/javascript";
  licenseKeyJs.src = licenseKeyURL;
  document.head.appendChild(licenseKeyJs);

  var scripts = document.getElementsByTagName('script');
  for (var index in scripts) {
    var match = scripts[index].src.match(filename);
    if (match && match.length > 0) {
      bitdashLibURL = match.input.match(/.*\//)[0];
      break;
    }
  }
  if (!bitdashLibURL) {
    console.error("Can't get path to script", filename);
    return;
  }
  bitdashLibURL += "bitdash.min.js";

  var playerJs = document.createElement("script");
  playerJs.type = "text/javascript";
  playerJs.src = bitdashLibURL;

  playerJs.onload = (function(callback) {
    bitdashLibLoaded = true;
  });
  document.head.appendChild(playerJs);

  /**
   * @class BitdashVideoFactory
   * @classdesc Factory for creating bitdash player objects that use HTML5 video tags.
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use.  True if elements can be created.
   * @property {object} encodings An array of supported encoding types (ex. OO.VIDEO.ENCODING.DASH)
   * @property {object} features An array of supported features (ex. OO.VIDEO.FEATURE.CLOSED_CAPTIONS)
   * @property {string} technology The core video technology (ex. OO.VIDEO.TECHNOLOGY.HTML5)
   */
  var BitdashVideoFactory = function() {
    this.name = pluginName;
    this.encodings = [ OO.VIDEO.ENCODING.DASH, OO.VIDEO.ENCODING.HLS, OO.VIDEO.ENCODING.MP4 ];
    this.features = [];
    this.technology = OO.VIDEO.TECHNOLOGY.HTML5;

    // This module defaults to ready because no setup or external loading is required
    this.ready = true;

    /**
     * Creates a video player instance using BitdashVideoWrapper.
     * @public
     * @method BitdashVideoFactory#create
     * @param {object} parentContainer The jquery div that should act as the parent for the video element
     * @param {string} domId The id of the video player instance to create
     * @param {object} ooyalaVideoController A reference to the video controller in the Ooyala player
     * @param {object} css The css to apply to the video element
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = function(parentContainer, domId, ooyalaVideoController, css) {
      var element = {};

      var videoWrapper = $("<div>");
      videoWrapper.attr("id", domId);
      videoWrapper.css(css);

      parentContainer.append(videoWrapper);
      var wrapper = new BitdashVideoWrapper(domId, videoWrapper[0]);
      currentInstances++;
      wrapper.controller = ooyalaVideoController;

      return wrapper;
    };

    /**
     * Destroys the video technology factory.
     * @public
     * @method BitdashVideoFactory#destroy
     */
    this.destroy = function() {
      this.ready = false;
      this.encodings = [];
      this.create = function() {};
    };

    /**
     * Represents the max number of support instances of video elements that can be supported on the
     * current platform. -1 implies no limit.
     * @public
     * @property BitdashVideoFactory#maxSupportedElements
     */
    this.maxSupportedElements = -1;
  };

  /**
   * @class BitdashVideoWrapper
   * @classdesc Player object that wraps the video element.
   * @param {string} domId The id of the video player instance
   * @param {object} video The core video object to wrap
   * @property {object} controller A reference to the Ooyala Video Tech Controller
   * @property {boolean} disableNativeSeek When true, the plugin should supress or undo seeks that come from
   *                                       native video controls
   */
  var BitdashVideoWrapper = function(domId, videoWrapper) {
    this.controller = {};
    this.disableNativeSeek = false;

    var _domId = domId;
    var _player = null;
    var _videoWrapper = videoWrapper;
    var _currentUrl = '';
    var _videoEnded = false;
    var _initialTime = 0;
    var _hasPlayed = false;
    var _currentTime = 0;
    var _isM3u8 = false;
    var _isDash = false;
    var _videoElement = null;

    var conf = {
      key: window.bitdashSettings.credentials.key,
      style: {
        width: '100%',
        height: '100%',
        ux: false
      },
      source: {
        hls: '',
        dash: '',
        poster: ''
      },
      playback: {
        autoplay: false,
        subtitleLanguage: 'en'
      },
      events: {
        onError: function(data) {
          console.error("bitdash error: " + data.code + ": " + data.message);
        }
      }
    };

    if (bitdashLibLoaded) {
      _player = bitdash(domId);
    } 


    /************************************************************************************/
    // Required. Methods that Video Controller, Destroy, or Factory call
    /************************************************************************************/

    /**
     * Sets the url of the video.
     * @public
     * @method BitdashVideoWrapper#setVideoUrl
     * @param {string} url The new url to insert into the video element's src attribute
     * @returns {boolean} True or false indicating success
     */
    this.setVideoUrl = function(url) {
      // check if we actually need to change the URL on video tag
      // compare URLs but make sure to strip out the trailing cache buster
      var urlChanged = false;
      if (_currentUrl.replace(/[\?&]_=[^&]+$/,'') != url) {
        _currentUrl = url || "";

        // bust the chrome caching bug
        if (_currentUrl.length > 0 && Platform.isChrome) {
          var rs = Math.random().toString(36).substring(7)
          _currentUrl = _currentUrl + (/\?/.test(_currentUrl) ? "&" : "?") + "_=" + rs;
        }

        _isM3u8 = (_currentUrl.toLowerCase().indexOf("m3u8") > 0);
        _isDash = (_currentUrl.toLowerCase().indexOf("mpd") > 0);

        _readyToPlay = false;
        urlChanged = true;
        resetStreamData();
      }

      if (_.isEmpty(url)) {
        this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: 0 }); //0 -> no stream
      }

      if (urlChanged) {
        conf.source.dash = (_isDash ? _currentUrl : "");
        conf.source.hls = (_isM3u8 ? _currentUrl : "");
        conf.source.progressive = (_isDash || _isM3u8 ? "" : [ _currentUrl ]);

        if (bitdashLibLoaded) {
          if (_hasPlayed) {
            this.load(false);
          } else {
            _player.setup(conf);
            OO.log("Bitdash player has been set up!");
          } 
        } else {
          var start = Date.now();
          (function waitForLibrary() {
            if (Date.now() - start >= BITDASH_LIB_TIMEOUT) {
              console.error("Timed out loading library");
              this.controller.notify(this.controller.EVENTS.CAN_PLAY);
              this.controller.notify(this.controller.EVENTS.ERROR, {errorcode:-1});
              return false;
            }
            setTimeout(function() {
              if (bitdashLibLoaded) {
                if (!_player) {
                  _player = bitdash(_domId);
                }
                _player.setup(conf);
                OO.log("Bitdash player has been set up!");
              } else {
                OO.log("Loading library...");
                waitForLibrary();
              } 
            }, 200);
          })();
        }
      }

      return urlChanged;
    };

    var resetStreamData = _.bind(function() {
      _hasPlayed = false;
      _videoEnded = false;
    }, this);

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method BitdashVideoWrapper#load
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = function(rewind) {
      _player.load(conf.source);
    };

    /**
     * Sets the initial time of the video playback.
     * @public
     * @method BitdashVideoWrapper#setInitialTime
     * @param {number} initialTime The initial time of the video (seconds)
     */
    this.setInitialTime = function(initialTime) {
      _initialTime = initialTime;
    };

    /**
     * Triggers playback on the video element.
     * @public
     * @method BitdashVideoWrapper#play
     */
    this.play = function() {
      _player.play();
      _hasPlayed = true;
      _videoEnded = false;
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method BitdashVideoWrapper#pause
     */
    this.pause = function() {
      _player.pause();
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method BitdashVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     */
    this.seek = function(time) {
      _player.seek(_hasPlayed ? time : _initialTime);
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method BitdashVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = function(volume) {
      _player.setVolume(volume * 100);
    };

    /**
     * Gets the current time position of the video.
     * @public
     * @method BitdashVideoWrapper#getCurrentTime
     * @returns {number} The current time position of the video (seconds)
     */
    this.getCurrentTime = function() {
      return _currentTime;
    }

    /**
     * Applies the given css to the video element.
     * @public
     * @method BitdashVideoWrapper#applyCss
     * @param {object} css The css to apply in key value pairs
     */
    this.applyCss = function(css) {
      $(_videoWrapper).css(css);
    };

    /**
     * Destroys the individual video element.
     * @public
     * @method BitdashVideoWrapper#destroy
     */
    this.destroy = function() {
      _player.destroy();
    };

    /**
     * Gets the range of video that can be safely seeked to.
     * @private
     * @method OoyalaVideoWrapper#getSafeSeekRange
     * @param {object} seekRange The seek range object from the video element.  It contains a length, a start
     *                           function, and an end function.
     * @returns {object} The safe seek range object containing { "start": number, "end": number}
     */
    var getSafeSeekRange = function(seekRange) {
      if (!seekRange || !seekRange.length || !(typeof seekRange.start == "function") ||
          !(typeof seekRange.end == "function" )) {
        return { "start" : 0, "end" : 0 };
      }

      return { "start" : seekRange.length > 0 ? seekRange.start(0) : 0,
               "end" : seekRange.length > 0 ? seekRange.end(0) : 0 };
    };

    /**************************************************/
    // BitPlayer event callbacks
    /**************************************************/

    var _onReady = conf.events["onReady"] = _.bind(function() {
      this.controller.notify(this.controller.EVENTS.CAN_PLAY);
      printevent(arguments);
    }, this);

    var _onPlay = conf.events["onPlay"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.PLAY);
      this.controller.notify(this.controller.EVENTS.PLAYING);
    }, this);

    var _onPause = conf.events["onPause"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.PAUSED);
    }, this);

    var _onSeek = conf.events["onSeek"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.SEEKING);
    }, this);

    var _onVolumeChange = conf.events["onVolumeChange"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { volume: arguments[0].volumeTarget });
    }, this);

    var _onMute = conf.events["onMute"] = _.bind(function() {
      printevent(arguments);
    }, this);

    var _onUnmute = conf.events["onUnmute"] = _.bind(function() {
      printevent(arguments);
    }, this);

    var _onFullscreenEnter = conf.events["onFullscreenEnter"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { isFullScreen: true, paused: _player.isPaused() });
    }, this);

    var _onFullscreenExit = conf.events["onFullscreenExit"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { isFullScreen: false, paused: _player.isPaused() });
    }, this);

    var _onPlaybackFinished = conf.events["onPlaybackFinished"] = _.bind(function() {
      printevent(arguments);
      if (_videoEnded) {
        // no double firing ended event
        return;
      }
      _videoEnded = true;
      this.controller.notify(this.controller.EVENTS.ENDED);
    }, this);

    var _onStartBuffering = conf.events["onStartBuffering"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.BUFFERING);
    }, this);

    var _onStopBuffering = conf.events["onStopBuffering"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.BUFFERED);
    }, this);

    var _onAudioChange = conf.events["onAudioChange"] = _.bind(function() {
      printevent(arguments);
    }, this);

    var _onSubtitleChange = conf.events["onSubtitleChange"] = _.bind(function() {
      // TO BE IMPLEMENTED
      var sub = _player.getSubtitle();
      if (sub && sub["id"]) {
        //this.mb.publish("ccLanguage", sub.id);
      }
      var ccLanguages = _player.getAvailableSubtitles();
      var ids = [];
      for (var i in ccLanguages) {
        ids.push(ccLanguages[i].id || "off");
      }
      //this.mb.publish("subtitles", ids);
      printevent(arguments);
    }, this);

    var _onVideoDownloadQualityChange = conf.events["onVideoDownloadQualityChange"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    var _onAudioDownloadQualityChange = conf.events["onAudioDownloadQualityChange"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    var _onVideoPlaybackQualityChange = conf.events["onVideoPlaybackQualityChange"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    var _onAudioPlaybackQualityChange = conf.events["onAudioPlaybackQualityChange"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    var _onTimeChanged = conf.events["onTimeChanged"] = _.bind(function(data) {
      printevent([data]);
      _currentTime = data.time;
      if (!_videoElement) {
        _videoElement = $("#bitdash-video-" + _domId)[0];
      }
      var buffer = 0;
      if (_videoElement.buffered && _videoElement.buffered.length > 0) {
        buffer = _videoElement.buffered.end(0); // in sec;
      }
      this.controller.notify(this.controller.EVENTS.TIME_UPDATE,
                             { currentTime: _currentTime,
                               duration: _videoElement.duration,
                               buffer: buffer,
                               seekRange: getSafeSeekRange(_videoElement.seekable)});
    }, this);

    var _onCueEnter = conf.events["onCueEnter"] = _.bind(function() {
      // TO BE IMPLEMENTED
      printevent(arguments);
    }, this);

    var _onCueExit = conf.events["onCueExit"] = _.bind(function() {
      // TO BE IMPLEMENTED
      printevent(arguments);
    }, this);

    var _onMetadata = conf.events["onMetadata"] = _.bind(function() {
      // TO BE IMPLEMENTED
      printevent(arguments);
    }, this);

    var printevent = function(arr) {
      // XXX this is debugging code, should be removed before release
      console.log("bitplayer:", arr[0].type, JSON.stringify(arr[0]));
    };
  };

  /**
   * @class Platform
   * @classdesc Functions that provide platform information
   */
  var Platform = {
    /**
     * Checks if the player is running in Chrome.
     * @private
     * @method Platform#isChrome
     * @returns {boolean} True if the player is running in chrome
     */
    isChrome: (function() {
      return !!window.navigator.userAgent.match(/Chrome/);
    })(),
  };

  OO.Video.plugin(new BitdashVideoFactory());
}(OO._, OO.$));
