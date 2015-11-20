/*
 * Plugin for bitdash player by Bitmovin GMBH
 */

(function(_, $) {
  var pluginName = "bitdash";
  var currentInstances = 0;

  /**
   * @class BitdashVideoFactory
   * @classdesc Factory for creating bitdash player objects that use HTML5 video tags.
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use.  True if elements can be created.
   * @property {object} streams An array of supported encoding types (ex. m3u8, mp4)
   */
  var BitdashVideoFactory = function() {
    this.name = pluginName;
    this.encodings = ["remote_asset", "mpd", "m3u8", "mp4"];

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

    /**
     * Returns the number of video elements currently instantiated.
     * @public
     * @method BitdashVideoFactory#getCurrentNumberOfInstances
     * @returns {int} The number of video elements created by this factory that have not been destroyed
     */
    this.getCurrentNumberOfInstances = function() {
      return 1;
    };
  };

  /**
   * @class BitdashVideoWrapper
   * @classdesc Player object that wraps the video element.
   * @param {string} domId The id of the video player instance
   * @param {object} video The core video object to wrap
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
    var _isSeeking = false;
    var _currentTime = 0;
    var _isM3u8 = false;
    var _isDash = false;
    var _videoElement = null;

    var conf = {
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
        },
        onReady: function() { _onReady(arguments); },
        onPlay: function() { _onPlay(arguments); },
        onPause: function() { _onPause(arguments); },
        onSeek: function() { _onSeek(arguments); },
        onVolumeChange: function() { _onVolumeChange(arguments); },
        onMute:  function() { _onMute(arguments); },
        onUnmute:  function() { _onUnmute(arguments); },
        onFullscreenEnter:  function() { _onFullscreenEnter(arguments); },
        onFullscreenExit:  function() { _onFullscreenExit(arguments); },
        onPlaybackFinished:  function() { _onPlaybackFinished(arguments); },
        onStartBuffering:  function() { _onStartBuffering(arguments); },
        onStopBuffering:  function() { _onStopBuffering(arguments); },
        onAudioChange:  function() { _onAudioChange(arguments); },
        onSubtitleChange:  function() { _onSubtitleChange(arguments); },
        onVideoDownloadQualityChange:  function() { _onVideoDownloadQualityChange(arguments); },
        onAudioDownloadQualityChange:  function() { _onAudioDownloadQualityChange(arguments); },
        onVideoPlaybackQualityChange:  function() { _onVideoPlaybackQualityChange(arguments); },
        onAudioPlaybackQualityChange:  function() { _onAudioPlaybackQualityChange(arguments); },
        onTimeChanged:  function() { _onTimeChanged(arguments); },
        onCueEnter:  function() { _onCueEnter(arguments); },
        onCueExit:  function() { _onCueExit(arguments); },
        onMetadata:  function() { _onMetadata(arguments); }
      }
    };

    _player = bitdash(domId);
    console.log("bitdash library loaded successfully");

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
        if (_isDash) {
          conf.source.dash = _currentUrl;
          conf.source.hls = '';
        } else if (_isM3u8) {
          conf.source.hls = _currentUrl;
          conf.source.dash = '';
        } else {
          conf.source.hls = '';
          conf.source.dash = '';
          conf.source.progressive = [ _currentUrl ];
        }
        conf.key = ''; // provide bitdash library key here
        _player.setup(conf);
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
      var source = {
        dash : (_isDash ? _currentUrl : ""),
        hls  : (_isM3u8 ? _currentUrl : ""),
        progressive: (_isDash || _isM3u8 ? "" : [ _currentUrl ])
      }
      _player.load(source);
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

    var _onReady = _.bind(function() {
      printevent(arguments);
    }, this);

    var _onPlay = _.bind(function() {
      _isSeeking = false;
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.PLAY);
      this.controller.notify(this.controller.EVENTS.PLAYING);
    }, this);

    var _onPause = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.PAUSED);
    }, this);

    var _onSeek = _.bind(function() {
      printevent(arguments);
      _isSeeking = true;
      this.controller.notify(this.controller.EVENTS.SEEKING);
    }, this);

    var _onVolumeChange = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { volume: arguments[0][0].volumeTarget });
    }, this);

    var _onMute = _.bind(function() {
      printevent(arguments);
    }, this);

    var _onUnmute = _.bind(function() {
      printevent(arguments);
    }, this);

    var _onFullscreenEnter = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { isFullScreen: true, paused: _player.isPaused() });
    }, this);

    var _onFullscreenExit = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { isFullScreen: false, paused: _player.isPaused() });
    }, this);

    var _onPlaybackFinished = _.bind(function() {
      printevent(arguments);
      if (_videoEnded) {
        // no double firing ended event
        return;
      }
      _videoEnded = true;
      this.controller.notify(this.controller.EVENTS.ENDED);
    }, this);

    var _onStartBuffering = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.BUFFERING);
    }, this);

    var _onStopBuffering = _.bind(function() {
      printevent(arguments);
      _isSeeking = false;
      this.controller.notify(this.controller.EVENTS.BUFFERED);
    }, this);

    var _onAudioChange = _.bind(function() {
      printevent(arguments);
    }, this);

    var _onSubtitleChange = _.bind(function() {
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

    var _onVideoDownloadQualityChange = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    var _onAudioDownloadQualityChange = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    var _onVideoPlaybackQualityChange = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    var _onAudioPlaybackQualityChange = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    var _onTimeChanged = _.bind(function(data) {
      printevent([data]);
      _currentTime = data[0].time;
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

    var _onCueEnter = _.bind(function() {
      // TO BE IMPLEMENTED
      printevent(arguments);
    }, this);

    var _onCueExit = _.bind(function() {
      // TO BE IMPLEMENTED
      printevent(arguments);
    }, this);

    var _onMetadata = _.bind(function() {
      // TO BE IMPLEMENTED
      printevent(arguments);
    }, this);

    var printevent = function(arr) {
      // XXX this is debugging code, should be removed before release
      console.log("bitplayer:", arr[0][0].type, JSON.stringify(arr[0][0]));
    };
  };

  /**
   * @class Platform
   * @classdesc Functions that provide platform information
   */
  var Platform = {
    /**
     * Checks if the system is running on iOS.
     * @private
     * @method Platform#isIos
     * @returns {boolean} True if the system is running on iOS
     */
    isIos: (function() {
      var platform = window.navigator.platform;
      return !!(platform.match(/iPhone/) || platform.match(/iPad/) || platform.match(/iPod/));
    })(),

    /**
     * Checks if the system is an iPad
     * @private
     * @method Platform#isIpad
     * @returns {boolean} True if the system is an Ipad
     */
    isIpad: (function() {
      return !!window.navigator.platform.match(/iPad/);
    })(),

    /**
     * Checks if the player is running in Chrome.
     * @private
     * @method Platform#isChrome
     * @returns {boolean} True if the player is running in chrome
     */
    isChrome: (function() {
      return !!window.navigator.userAgent.match(/Chrome/);
    })(),

    /**
     * Checks if the player is running in Safari.
     * @private
     * @method Platform#isSafari
     * @returns {boolean} True if the player is running in safari
     */
    isSafari: (function() {
      return (!!window.navigator.userAgent.match(/AppleWebKit/) &&
              !window.navigator.userAgent.match(/Chrome/));
    })(),

    /**
     * Gets the iOS major version.
     * @private
     * @method Platform#iosMajorVersion
     * @returns {?number} The iOS major version; null if the system is not running iOS
     */
    iosMajorVersion: (function(){
      try {
        if (window.navigator.userAgent.match(/(iPad|iPhone|iPod)/)) {
          return parseInt(window.navigator.userAgent.match(/OS (\d+)/)[1], 10);
        } else {
          return null;
        }
      } catch (err) {
        return null;
      }
    })(),

    /**
     * Checks if the player is running on an Android device.
     * @private
     * @method Platform#isAndroid
     * @returns {boolean} True if the player is running on an Android device
     */
    isAndroid: (function(){
      return !!window.navigator.appVersion.match(/Android/);
    })(),

    /**
     * Checks if the player is running on an Android device of version 4 or later.
     * @private
     * @method Platform#isAndroid4Plus
     * @returns {boolean} True if the player is running on an Android device of version 4 or later
     */
    isAndroid4Plus: (function(){
      if (!this.isAndroid) return false;
      var device = window.navigator.appVersion.match(/Android [1-9]/) || [];
      return (_.first(device) || "").slice(-1) >= "4";
    })(),

    /**
     * Checks if the player is running in Safari.
     * @private
     * @method Platform#isSafari
     * @returns {boolean} True if the player is running in safari
     */
    chromeMajorVersion: (function(){
      try {
        return parseInt(window.navigator.userAgent.match(/Chrome.([0-9]*)/)[1], 10);
      } catch(err) {
        return null;
      }
    })(),
  };

  OO.Video.plugin(new BitdashVideoFactory());
}(OO._, OO.$));
