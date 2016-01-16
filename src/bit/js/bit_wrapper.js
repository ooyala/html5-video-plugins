/*
 * Plugin for bitdash player by Bitmovin GMBH
 */

require("../../../html5-common/js/utils/InitModules/InitOO.js");
require("../../../html5-common/js/utils/InitModules/InitOOUnderscore.js");
require("../../../html5-common/js/utils/InitModules/InitOOHazmat.js");
require("../../../html5-common/js/utils/constants.js");
require("../../../html5-common/js/utils/environment.js");

(function(_, $) {
  var pluginName = "bitdash";
  var currentInstances = 0;
  var bitdashLibLoaded = false;
  var bitdashLibURL;
  var BITDASH_LIB_TIMEOUT = 30000;
  var filename = "bit_wrapper.*\.js";

  if (window.runningUnitTests) {
      bitdashLibLoaded = true;
  } else {
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
  }

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
    this.technology = OO.VIDEO.TECHNOLOGY.MIXED;
    this.features = [ OO.VIDEO.FEATURE.CLOSED_CAPTIONS ];

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
      videoWrapper.attr("class", "video");
      videoWrapper.attr("id", domId);
      videoWrapper.css(css);

      parentContainer.append(videoWrapper);
      var wrapper = new BitdashVideoWrapper(domId, ooyalaVideoController, videoWrapper[0]);
      currentInstances++;

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
  var BitdashVideoWrapper = function(domId, videoController, videoWrapper) {
    this.controller = videoController;
    this.disableNativeSeek = false;
    this.player = null;

    var _domId = domId;
    var _videoWrapper = videoWrapper;
    var _currentUrl = '';
    var _loaded = false;
    var _videoEnded = false;
    var _hasPlayed = false;
    var _currentTime = 0;
    var _isM3u8 = false;
    var _isDash = false;
    var _isSeeking = false;
    var _trackId = '';

    var conf = {
      key: this.controller.PLUGIN_MAGIC,
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
      this.player = bitdash(domId);
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
        if (_currentUrl.length > 0 && OO.isChrome) {
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
          if (!window.runningUnitTests) {
            if (_hasPlayed) {
              this.load(false);
            } else {
              this.player.setup(conf);
              _loaded = true;
              if (_isM3u8) {
                // XXX HACK - workaround for bitmovin problem reported in bug OOYALA-107
                // Should be removed once this bug is fixed
                this.controller.notify(this.controller.EVENTS.CAN_PLAY);
              } 
              OO.log("Bitdash player has been set up!");
            }
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
                if (!this.player) {
                  this.player = bitdash(_domId);
                }
                this.player.setup(conf);
                _loaded = true;
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

    /**
     * Sets the closed captions on the video element.
     * @public
     * @method BitdashVideoWrapper#setClosedCaptions
     * @param {string} language The language of the closed captions. If null, the current closed captions will be removed.
     * @param {object} closedCaptions The closedCaptions object
     * @param {object} params The params to set with closed captions
     */
    this.setClosedCaptions = function(language, closedCaptions, params) {
      if (!!language && params.mode === "showing") {
        var captions =  this.player.getAvailableSubtitles() || [];
        var trackId = "1";
        if (captions.length > 0) {
          if (captions[captions.length - 1].lang === language) {
            if (closedCaptions.closed_captions_vtt && closedCaptions.closed_captions_vtt[language]) {
              if (captions[captions.length - 1].label === closedCaptions.closed_captions_vtt[language].name) {
                console.warning("Closed captions track '", trackId, "' has already been installed");
                // this track has already been installed
                return;
              }
            } else {
              // XXX add cases for DFXP or precaution if there is none of these
              return;
            }
            trackId = (parseInt(captions[captions.length - 1].id) + 1).toString();
          }
        }
        this.player.addSubtitle(
          closedCaptions.closed_captions_vtt[language].url,
          trackId,
          "subtitle",
          language,
          closedCaptions.closed_captions_vtt[language].name);
        this.player.setSubtitle(trackId);
        _trackId = trackId;
      } else {
        this.player.setSubtitle(null);
      }
    };

    /**
     * Sets the closed captions mode on the video element.
     * @public
     * @method BitdashVideoWrapper#setClosedCaptionsMode
     * @param {string} mode The mode to set the text tracks element. One of ("disabled", "hidden", "showing").
     */
    this.setClosedCaptionsMode = function(mode) {
      if (mode === "hidden") {
        this.player.setSubtitle(null);
      } else if (mode === "disabled") {
        this.player.setSubtitle(null);
      } else if (mode === "showing" && !!_trackId) {
        this.player.setSubtitle(_trackId);
      }
    };

    /**
     * Sets the crossorigin attribute on the video element.
     * @public
     * @method BitdashVideoWrapper#setCrossorigin
     * @param {string} crossorigin The value to set the crossorigin attribute. Will remove crossorigin attribute if null.
     */
    this.setCrossorigin = function(crossorigin) {
      if (crossorigin) {
        $(_videoWrapper).attr("crossorigin", crossorigin);
      } else {
        $(_videoWrapper).removeAttr("crossorigin");
      }
    };

    var resetStreamData = _.bind(function() {
      _hasPlayed = false;
      _videoEnded = false;
      _isSeeking = false;
      _loaded = false;
      _currentTime = 0;
    }, this);

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method BitdashVideoWrapper#load
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = function(rewind) {
      if (_loaded && !rewind) {
        return;
      }
      if (!!rewind) {
        _currentTime = 0;
        this.player.pause();
      }
      this.player.load(conf.source);
      _loaded = true;
    };

    /**
     * Sets the initial time of the video playback.
     * @public
     * @method BitdashVideoWrapper#setInitialTime
     * @param {number} initialTime The initial time of the video (seconds)
     */
    this.setInitialTime = function(initialTime) {
      if (!_hasPlayed && initialTime > 0) {
        this.seek(initialTime);
      }
    };

    /**
     * Triggers playback on the video element.
     * @public
     * @method BitdashVideoWrapper#play
     */
    this.play = function() {
      if (this.player.isReady() && !_isSeeking) {
        if (!_loaded) {
          this.load();
        }
        if (_loaded) {
          this.player.play();
          _hasPlayed = true;
          _videoEnded = false;
        }
      }
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method BitdashVideoWrapper#pause
     */
    this.pause = function() {
      this.player.pause();
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method BitdashVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     */
    this.seek = function(time) {
      var safeTime = getSafeSeekTimeIfPossible(time);

      if (safeTime !== null) {
        _isSeeking = true;
        this.controller.notify(this.controller.EVENTS.SEEKING, safeTime);
        this.player.seek(safeTime);
        _currentTime = safeTime;
        
        return true;
      }

      // XXX we may also have to add queueSeek / dequeueSeek as it is done for main_html5 plugin
      return false;
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method BitdashVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = function(volume) {
      var resolvedVolume = volume;
      if (resolvedVolume < 0) {
        resolvedVolume = 0;
      } else if (resolvedVolume > 1) {
        resolvedVolume = 1;
      }

      this.player.setVolume(resolvedVolume * 100);
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
      this.player.pause();
      _currentUrl = '';
      $(_videoWrapper).remove();
      currentInstances--;
      this.player.destroy();
    };

    /************************************************************************************/
    // Helper methods
    /************************************************************************************/

    /**
     * Gets the range of video that can be safely seeked to.
     * @private
     * @method BitdashWrapper#getSafeSeekRange
     * @param {object} seekRange The seek range object from the video element.  It contains a length, a start
     *                           function, and an end function.
     * @returns {object} The safe seek range object containing { "start": number, "end": number}
     */
    var getSafeSeekRange = function() {
      // This code may require follow-up for live streams of for specific-to-platform corner cases
      return { start: 0, end: player.getDuration() };
    };

    /**
     * Converts the desired seek time to a safe seek time based on the duration and platform.  If seeking
     * within OO.CONSTANTS.SEEK_TO_END_LIMIT of the end of the stream, seeks to the end of the stream.
     * @private
     * @method BitdashWrapper#convertToSafeSeekTime
     * @param {number} time The desired seek-to position
     * @param {number} duration The video's duration
     * @returns {number} The safe seek-to position
     */
    var convertToSafeSeekTime = function(time, duration) {
      // If seeking within some threshold of the end of the stream, seek to end of stream directly
      if (duration - time < OO.CONSTANTS.SEEK_TO_END_LIMIT) {
        time = duration;
      }

      var safeTime = time >= duration ? duration - 0.01 : (time < 0 ? 0 : time);

      // iPad with 6.1 has an interesting bug that causes the video to break if seeking exactly to zero
      if (OO.isIpad && safeTime < 0.1) {
        safeTime = 0.1;
      }
      return safeTime;
    };

    /**
     * Returns the safe seek time if seeking is possible.  Null if seeking is not possible.
     * @private
     * @method BitdashWrapper#getSafeSeekTimeIfPossible
     * @param {number} time The desired seek-to position
     * @returns {?number} The seek-to position, or null if seeking is not possible
     */
    var getSafeSeekTimeIfPossible = function(time) {
      if (typeof time !== "number") {
        return null;
      }

      var safeTime = convertToSafeSeekTime(time, player.getDuration());
      var seekRange = getSafeSeekRange();
      if (seekRange.start <= safeTime && seekRange.end >= safeTime) {
        return safeTime;
      }

      return null;
    };

    /**************************************************/
    // BitPlayer event callbacks
    /**************************************************/

    var _onReady = conf.events["onReady"] = _.bind(function() {
      printevent(arguments);
      if (_isM3u8 && !OO.isIos) {
        // XXX HACK - workaround for bitmovin problem reported in bug OOYALA-107
        // Should be removed once this bug is fixed
        this.player.play();
      } 
      this.controller.notify(this.controller.EVENTS.CAN_PLAY);
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
      _isSeeking = true;
      this.controller.notify(this.controller.EVENTS.SEEKING, arguments[0].seekTarget);
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
                             { isFullScreen: true, paused: this.player.isPaused() });
    }, this);

    var _onFullscreenExit = conf.events["onFullscreenExit"] = _.bind(function() {
      printevent(arguments);
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { isFullScreen: false, paused: this.player.isPaused() });
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
      if (_isSeeking) {
        _isSeeking = false;
        this.controller.notify(this.controller.EVENTS.SEEKED);
      }
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
      _currentTime = this.player.getCurrentTime();
      var buffer = this.player.getVideoBufferLength();
      var duration = this.player.getDuration();
      this.controller.notify(this.controller.EVENTS.TIME_UPDATE,
                             { currentTime: _currentTime,
                               duration: duration,
                               buffer: buffer + _currentTime,
                               seekRange: { "start" : 0, "end" : duration } });
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
      if (arr[0].type !== "onTimeChanged") {
        console.log("bitplayer:", arr[0].type, JSON.stringify(arr[0]));
      }
    };
  };

  OO.Video.plugin(new BitdashVideoFactory());
}(OO._, OO.$));
