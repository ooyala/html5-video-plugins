/*
 * Simple HTML5 video tag plugin for mp4 and hls
 * version: 0.1
 */

require("../../../html5-common/js/utils/InitModules/InitOO.js");
require("../../../html5-common/js/utils/InitModules/InitOOUnderscore.js");
require("../../../html5-common/js/utils/InitModules/InitOOHazmat.js");
require("../../../html5-common/js/utils/constants.js");
require("../../../html5-common/js/utils/environment.js");

(function(_, $) {
  var pluginName = "ooyalaHtml5VideoTech";
  var currentInstances = 0;

  /**
   * @class OoyalaVideoFactory
   * @classdesc Factory for creating video player objects that use HTML5 video tags
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use.  True if elements can be created.
   * @property {object} encodings An array of supported encoding types (ex. OO.VIDEO.ENCODING.MP4)
   * @property {object} features An array of supported features (ex. OO.VIDEO.FEATURE.CLOSED_CAPTIONS)
   * @property {string} technology The core video technology (ex. OO.VIDEO.TECHNOLOGY.HTML5)
   */
  var OoyalaVideoFactory = function() {
    this.name = pluginName;

    // This module defaults to ready because no setup or external loading is required
    this.ready = true;

    this.features = [ OO.VIDEO.FEATURE.CLOSED_CAPTIONS,
                      OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE ];
    this.technology = OO.VIDEO.TECHNOLOGY.HTML5;

    // Determine supported encodings
    var getSupportedEncodings = function() {
      var videoElement = document.createElement("video");
      var list = [OO.VIDEO.ENCODING.MP4];
      if (!OO.isSafari) {
        list.push(OO.VIDEO.ENCODING.WEBM);
      }
      if (!!videoElement.canPlayType("application/vnd.apple.mpegurl") ||
          !!videoElement.canPlayType("application/x-mpegURL")) {
        list.push(OO.VIDEO.ENCODING.HLS);
      }

      return list;
    };
    this.encodings = getSupportedEncodings();

    /**
     * Creates a video player instance using OoyalaVideoWrapper
     * @public
     * @method OoyalaVideoFactory#create
     * @param {object} parentContainer The jquery div that should act as the parent for the video element
     * @param {string} domId The dom id of the video player instance to create
     * @param {object} controller A reference to the video controller in the Ooyala player
     * @param {object} css The css to apply to the video element
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = function(parentContainer, domId, controller, css) {
      if (this.maxSupportedElements > 0 && currentInstances >= this.maxSupportedElements) {
        return;
      }

      var video = $("<video>");
      video.attr("class", "video");
      video.attr("id", domId);
      video.attr("preload", "none");

      video.css(css);

      // enable airplay for iOS
      // http://developer.apple.com/library/safari/#documentation/AudioVideo/Conceptual/AirPlayGuide/OptingInorOutofAirPlay/OptingInorOutofAirPlay.html
      if (OO.isIos) {
        video.attr("x-webkit-airplay", "allow");
      }

      // Set initial container dimension
      var dimension = {
        width: parentContainer.width(),
        height: parentContainer.height()
      };

      var element = new OoyalaVideoWrapper(domId, video[0], dimension);
      currentInstances++;
      element.controller = controller;
      controller.notify(controller.EVENTS.CAN_PLAY);

      // TODO: Wait for loadstart before calling this?
      element.subscribeAllEvents();

      parentContainer.append(video);

      // On Android, we need to "activate" the video on a click so we can control it with JS later on mobile
      if (OO.isAndroid) {
        element.play();
        element.pause();
      }
      return element;
    };

    /**
     * Destroys the video technology factory
     * @public
     * @method OoyalaVideoFactory#destroy
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
     * @property OoyalaVideoFactory#maxSupportedElements
     */
    this.maxSupportedElements = (function() {
      var iosRequireSingleElement = OO.isIos;
      var androidRequireSingleElement = OO.isAndroid &&
                                        (!Platform.isAndroid4Plus || OO.chromeMajorVersion < 40);
      return (iosRequireSingleElement || androidRequireSingleElement) ? 1 : -1;
    })();
  };

  /**
   * @class OoyalaVideoWrapper
   * @classdesc Player object that wraps HTML5 video tags
   * @param {string} domId The dom id of the video player element
   * @param {object} video The core video object to wrap
   * @param {object} dimension JSON object specifying player container's initial width and height
   * @property {object} controller A reference to the Ooyala Video Tech Controller
   * @property {boolean} disableNativeSeek When true, the plugin should supress or undo seeks that come from
   *                                       native video controls
   */
  var OoyalaVideoWrapper = function(domId, video, dimension) {
    this.controller = {};
    this.disableNativeSeek = false;

    var _video = video;
    var _currentUrl = '';
    var videoEnded = false;
    var listeners = {};
    var loaded = false;
    var canPlay = false;
    var hasPlayed = false;
    var queuedSeekTime = null;
    var playQueued = false;
    var isSeeking = false;
    var currentTime = 0;
    var isM3u8 = false;
    var TRACK_CLASS = "track_cc";
    var firstPlay = true;
    var playerDimension = dimension;
    var videoDimension = {height: 0, width: 0};
    var queuedInitialTime = 0;
    var canSeek = true;

    // Watch for underflow on Chrome
    var underflowWatcherTimer = null;
    var waitingEventRaised = false;
    var watcherTime = -1;

    // iPad CSS constants
    var IPAD_CSS_DEFAULT = {
      "width":"",
      "height":"",
      "left":"50%",
      "top":"50%",
      "-webkit-transform":"translate(-50%,-50%)",
      "visibility":"visible"
    };

    // [PBW-4000] On Android, if the chrome browser loses focus, then the stream cannot be seeked before it
    // is played again.  Detect visibility changes and delay seeks when focus is lost.
    if (OO.isAndroid && OO.isChrome) {
      var watchHidden = _.bind(function(evt) {
        if (document.hidden) {
          console.log("On Android make seekable false");
          canSeek = false;
        }
      }, this)
      document.addEventListener("visibilitychange", watchHidden);
    }

    /************************************************************************************/
    // External Methods that Video Controller or Factory call
    /************************************************************************************/
    /**
     * Hands control of the video element off to another plugin by unsubscribing from all events.
     * @public
     * @method OoyalaVideoWrapper#sharedElementGive
     */
    this.sharedElementGive = function() {
      unsubscribeAllEvents();
      _currentUrl = "";
    };

    /**
     * Takes control of the video element from another plugin by subscribing to all events.
     * @public
     * @method OoyalaVideoWrapper#sharedElementTake
     */
    this.sharedElementTake = function() {
      this.subscribeAllEvents();
    };

    /**
     * Subscribes to all events raised by the video element.
     * This is called by the Factory during creation.
     * @public
     * @method OoyalaVideoWrapper#subscribeAllEvents
     */
    this.subscribeAllEvents = function() {
      listeners = { "loadstart": onLoadStart,
                    "loadedmetadata": onLoadedMetadata,
                    "progress": raiseProgress,
                    "error": raiseErrorEvent,
                    "stalled": raiseStalledEvent,
                    "canplay": raiseCanPlay,
                    "canplaythrough": raiseCanPlayThrough,
                    "playing": raisePlayingEvent,
                    "waiting": raiseWaitingEvent,
                    "seeking": raiseSeekingEvent,
                    "seeked": raiseSeekedEvent,
                    "ended": raiseEndedEvent,
                    "durationchange": raiseDurationChange,
                    "timeupdate": raiseTimeUpdate,
                    "play": raisePlayEvent,
                    "pause": raisePauseEvent,
                    "ratechange": raiseRatechangeEvent,
                    "volumechange": raiseVolumeEvent,
                    "volumechangeNew": raiseVolumeEvent,
                        // ios webkit browser fullscreen events
                    "webkitbeginfullscreen": raiseFullScreenBegin,
                    "webkitendfullscreen": raiseFullScreenEnd
                  };
      // events not used:
      // suspend, abort, emptied, loadeddata, resize, change, addtrack, removetrack
      _.each(listeners, function(v, i) { $(_video).on(i, v); }, this);
    };

    /**
     * Unsubscribes all events from the video element.
     * This is called by the destroy function.
     * @private
     * @method OoyalaVideoWrapper#unsubscribeAllEvents
     */
    var unsubscribeAllEvents = function() {
      _.each(listeners, function(v, i) { $(_video).off(i, v); }, this);
    };

    /**
     * Sets the url of the video.
     * @public
     * @method OoyalaVideoWrapper#setVideoUrl
     * @param {string} url The new url to insert into the video element's src attribute
     * @returns {boolean} True or false indicating success
     */
    // Allow for the video src to be changed without loading the video
    this.setVideoUrl = function(url) {
      // check if we actually need to change the URL on video tag
      // compare URLs but make sure to strip out the trailing cache buster
      var urlChanged = false;
      if (_currentUrl.replace(/[\?&]_=[^&]+$/,'') != url) {
        _currentUrl = url || "";

        // bust the chrome caching bug
        if (_currentUrl.length > 0 && OO.isChrome) {
          _currentUrl = _currentUrl + (/\?/.test(_currentUrl) ? "&" : "?") + "_=" + getRandomString();
        }

        isM3u8 = (_currentUrl.toLowerCase().indexOf("m3u8") > 0);
        urlChanged = true;
        resetStreamData();
        _video.src = _currentUrl;
      }

      return urlChanged;
    };

    var resetStreamData = _.bind(function() {
      playQueued = false;
      canPlay = false;
      hasPlayed = false;
      queuedSeekTime = null;
      loaded = false;
      isSeeking = false;
      firstPlay = true;
      currentTime = 0;
      videoEnded = false;
      videoDimension = {height: 0, width: 0};
      canSeek = true;
      stopUnderflowWatcher();
    }, this);

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method OoyalaVideoWrapper#load
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = function(rewind) {
      if (loaded && !rewind) return;
      if (!!rewind) {  // consider adding loaded &&
        try {
          if (OO.isIos && OO.iosMajorVersion == 8) {
            // On iOS, wait for durationChange before setting currenttime
            $(_video).on("durationchange", _.bind(function() {
                                                               _video.currentTime = 0;
                                                               currentTime = 0;
                                                             }, this));
          } else {
            _video.currentTime = 0;
            currentTime = 0;
          }
          _video.pause();
        } catch (ex) {
          // error because currentTime does not exist because stream hasn't been retrieved yet
          console.log('VTC_OO: Failed to rewind video, probably ok; continuing');
        }
      }
      _video.load();
      loaded = true;
    };

    /**
     * Sets the initial time of the video playback.  For this plugin that is simply a seek which will be
     * triggered upon 'loadedmetadata' event.
     * @public
     * @method OoyalaVideoWrapper#setInitialTime
     * @param {number} initialTime The initial time of the video (seconds)
     */
    this.setInitialTime = function(initialTime) {
      if (!hasPlayed && (initialTime !== 0)) {
        queuedInitialTime = initialTime;

        // [PBW-3866] Some Android devices (mostly Nexus) cannot be seeked too early or the seeked event is
        // never raised, even if the seekable property returns an endtime greater than the seek time.
        // To avoid this, save seeking information for use later.
        if (OO.isAndroid) {
          queueSeek(initialTime);
        }
        else {
          this.seek(initialTime);
        }
      }
    };

    /**
     * Triggers playback on the video element.
     * @public
     * @method OoyalaVideoWrapper#play
     */
    this.play = function() {
      // enqueue play command if in the process of seeking
      if (_video.seeking) {
        playQueued = true;
      } else {
        executePlay();
      }
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method OoyalaVideoWrapper#pause
     */
    this.pause = function() {
      playQueued = false;
      _video.pause();
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method OoyalaVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     */
    this.seek = function(time) {
      var safeTime = getSafeSeekTimeIfPossible(_video, time);
      if (safeTime !== null) {
        _video.currentTime = safeTime;
        isSeeking = true;
        return true;
      }
      queueSeek(time);
      return false;
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method OoyalaVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = function(volume) {
      var resolvedVolume = volume;
      if (resolvedVolume < 0) {
        resolvedVolume = 0;
      } else if (resolvedVolume > 1) {
        resolvedVolume = 1;
      }

      //  TODO check if we need to capture any exception here. ios device will not allow volume set.
      _video.volume = resolvedVolume;
    };

    /**
     * Gets the current time position of the video.
     * @public
     * @method OoyalaVideoWrapper#getCurrentTime
     * @returns {number} The current time position of the video (seconds)
     */
    this.getCurrentTime = function() {
      return _video.currentTime;
    };

    /**
     * Applies the given css to the video element.
     * @public
     * @method OoyalaVideoWrapper#applyCss
     * @param {object} css The css to apply in key value pairs
     */
    this.applyCss = function(css) {
      $(_video).css(css);
      setVideoCentering();
    };

    /**
     * Destroys the individual video element.
     * @public
     * @method OoyalaVideoWrapper#destroy
     */
    this.destroy = function() {
      _video.pause();
      _video.src = '';
      unsubscribeAllEvents();
      $(_video).remove();
      currentInstances--;
      if (watchHidden) {
        document.removeEventListener("visibilitychange", watchHidden);
      }
    };

    /**
     * Sets the closed captions on the video element.
     * @public
     * @method OoyalaVideoWrapper#setClosedCaptions
     * @param {string} language The language of the closed captions. If null, the current closed captions will be removed.
     * @param {object} closedCaptions The closedCaptions object
     * @param {object} params The params to set with closed captions
     */
    this.setClosedCaptions = function(language, closedCaptions, params) {
      $(_video).find('.' + TRACK_CLASS).remove();
      if (language == null) return;

      // The textTrack added by QuickTime will not be removed by removing track element
      // But the textTrack that we added by adding track element will be removed by removing track element.
      // This first check is to check for live CC
      if (OO.isSafari && _video.textTracks.length !== 0) {
        for (var i = 0; i < _video.textTracks.length; i++) {
          if (_video.textTracks[i].language === language ||
              (language == "CC" && _video.textTracks[i].kind === "captions")) {
            var mode = (!!params && params.mode) || 'showing';
            _video.textTracks[i].mode = mode;
          } else {
           _video.textTracks[i].mode = 'disabled';
          }
        }
      } else {
        var captionsFormat = "closed_captions_vtt";
        if (closedCaptions[captionsFormat] && closedCaptions[captionsFormat][language]) {
          var captions = closedCaptions[captionsFormat][language];
          var label = captions.name;
          var src = captions.url;
          var mode = (!!params && params.mode) || 'showing';

          $(_video).append("<track class='" + TRACK_CLASS + "' kind='subtitles' label='" + label + "' src='" + src + "' srclang='" + language + "' default>");

          _.delay(function() {
            _video.textTracks[0].mode = mode;
            if (OO.isFirefox) {
              for (var i=0; i < _video.textTracks[0].cues.length; i++) {
                _video.textTracks[0].cues[i].line = 15;
              }
            }
          }, 100);
        }
      }
    };

    /**
     * Sets the closed captions mode on the video element.
     * @public
     * @method OoyalaVideoWrapper#setClosedCaptionsMode
     * @param {string} mode The mode to set the text tracks element. One of ("disabled", "hidden", "showing").
     */
    this.setClosedCaptionsMode = function(mode) {
      if (_video.textTracks) {
        for (var i = 0; i < _video.textTracks.length; i++) {
          _video.textTracks[i].mode = mode;
        }
      }
    };

    /**
     * Sets the crossorigin attribute on the video element.
     * @public
     * @method OoyalaVideoWrapper#setCrossorigin
     * @param {string} crossorigin The value to set the crossorigin attribute. Will remove crossorigin attribute if null.
     */
    this.setCrossorigin = function(crossorigin) {
      if (crossorigin) {
        $(_video).attr("crossorigin", crossorigin);
      } else {
        $(_video).removeAttr("crossorigin");
      }
    };

    // **********************************************************************************/
    // Event callback methods
    // **********************************************************************************/

    /**
     * Stores the url of the video when load is started.
     * @private
     * @method OoyalaVideoWrapper#onLoadStart
     */
    var onLoadStart = _.bind(function() {
      stopUnderflowWatcher();
      _currentUrl = _video.src;
      firstPlay = true;
      videoEnded = false;
      isSeeking = false;
    }, this);

    /**
     * When metadata is done loading, trigger any seeks that were queued up.
     * @private
     * @method OoyalaVideoWrapper#onLoadedMetadata
     */
    var onLoadedMetadata = _.bind(function() {
      dequeueSeek();
    }, this)

    /**
     * Notifies the controller that a progress event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseProgress
     * @param {object} event The event from the video
     */
    var raiseProgress = _.bind(function(event) {
      var buffer = 0;
      if (event.target.buffered && event.target.buffered.length > 0) {
        buffer = event.target.buffered.end(0); // in sec;
      }
      this.controller.notify(this.controller.EVENTS.PROGRESS,
                             { "currentTime": event.target.currentTime,
                               "duration": resolveDuration(event.target.duration),
                               "buffer": buffer,
                               "seekRange": getSafeSeekRange(event.target.seekable)
                             });
    }, this);

    /**
     * Notifies the controller that an error event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseErrorEvent
     * @param {object} event The event from the video
     */
    var raiseErrorEvent = _.bind(function(event) {
      stopUnderflowWatcher();
      var code = event.target.error ? event.target.error.code : -1;
      this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: code });
    }, this);

    /**
     * Notifies the controller that a stalled event was raised.  Pauses the video on iPad if the currentTime is 0.
     * @private
     * @method OoyalaVideoWrapper#raiseStalledEvent
     * @param {object} event The event from the video
     */
    var raiseStalledEvent = _.bind(function(event) {
      // Fix multiple video tag error in iPad
      if (OO.isIpad && event.target.currentTime === 0) {
        _video.pause();
      }

      this.controller.notify(this.controller.EVENTS.STALLED, {"url":_video.currentSrc});
    }, this);

    /**
     * HTML5 video browser can start playing the media. Sets canPlay flag to TRUE
     * @private
     * @method OoyalaVideoWrapper#raiseCanPlay
     */
    var raiseCanPlay = _.bind(function() {
      // On firefox and iOS, at the end of an underflow the video raises 'canplay' instead of
      // 'canplaythrough'.  If that happens, raise canPlayThrough.
      if ((OO.isFirefox || OO.isIos) && waitingEventRaised) {
        raiseCanPlayThrough();
      }
      canPlay = true;
    }, this);

    /**
     * Notifies the controller that a buffered event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseCanPlayThrough
     */
    var raiseCanPlayThrough = _.bind(function() {
      waitingEventRaised = false;
      this.controller.notify(this.controller.EVENTS.BUFFERED, {"url":_video.currentSrc});
    }, this);

    /**
     * Notifies the controller that a playing event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePlayingEvent
     */
    var raisePlayingEvent = _.bind(function() {
      this.controller.notify(this.controller.EVENTS.PLAYING);

      startUnderflowWatcher();

      //Check for live closed captions and notify controller
      if (firstPlay && _video.textTracks && _video.textTracks.length > 0) {
        var languages = [];
        for (var i = 0; i < _video.textTracks.length; i++) {
          if (_video.textTracks[i].kind === "captions") {
            this.controller.notify(this.controller.EVENTS.CAPTIONS_FOUND_ON_PLAYING);
          }
        }
      }
      firstPlay = false;
      canSeek = true;
      setVideoCentering();
    }, this);

    /**
     * Notifies the controller that a waiting event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseWaitingEvent
     */
    var raiseWaitingEvent = _.bind(function() {
      waitingEventRaised = true;
      this.controller.notify(this.controller.EVENTS.WAITING, {"url":_video.currentSrc});
    }, this);

    /**
     * Notifies the controller that a seeking event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseSeekingEvent
     */
    var raiseSeekingEvent = _.bind(function() {
      isSeeking = true;
      this.controller.notify(this.controller.EVENTS.SEEKING);
    }, this);

    /**
     * Notifies the controller that a seeked event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseSeekedEvent
     */
    var raiseSeekedEvent = _.bind(function() {
      queuedInitialTime = 0;

      // After done seeking, see if any play events were received and execute them now
      // This fixes an issue on iPad where playing while seeking causes issues with end of stream eventing.
      dequeuePlay();

      // PBI-718 - If seeking is disabled and a native seek was received, seek back to the previous position.
      // This is required for platforms with native controls that cannot be disabled, such as iOS
      if (this.disableNativeSeek) {
        var fixedSeekedTime = Math.floor(_video.currentTime);
        var fixedCurrentTime = Math.floor(currentTime);
        if (fixedSeekedTime !== fixedCurrentTime) {
          _video.currentTime = currentTime;
        }
      }
      this.controller.notify(this.controller.EVENTS.SEEKED);
      isSeeking = false;
    }, this);

    /**
     * Notifies the controller that a ended event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseEndedEvent
     */
    var raiseEndedEvent = _.bind(function(event) {
      stopUnderflowWatcher();
      if (!_video.ended && OO.isSafari) {
        // iOS raises ended events sometimes when a new stream is played in the same video element
        // Prevent this faulty event from making it to the player message bus
        return;
      }
      if (videoEnded) { return; } // no double firing ended event.
      videoEnded = true;

      this.controller.notify(this.controller.EVENTS.ENDED);
    }, this);

    /**
     * Notifies the controller that the duration has changed.
     * @private
     * @method OoyalaVideoWrapper#raiseDurationChange
     * @param {object} event The event from the video
     */
    var raiseDurationChange = _.bind(function(event) {
      raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
    }, this);

    /**
     * Notifies the controller that the time position has changed.  Handles seeks if seeks were enqueued and
     * the stream has become seekable.  Triggers end of stream for m3u8 if the stream won't raise it itself.
     * @private
     * @method OoyalaVideoWrapper#raiseTimeUpdate
     * @param {object} event The event from the video
     */
    var raiseTimeUpdate = _.bind(function(event) {
      if (!isSeeking) {
        currentTime = _video.currentTime;
      }

      if (queuedInitialTime && (event.target.currentTime >= queuedInitialTime)) {
        queuedInitialTime = 0;
      }

      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event);

      // iOS has issues seeking so if we queue a seek handle it here
      dequeueSeek();

      // iPad safari has video centering issue. Unfortunately, HTML5 does not have bitrate change event.
      setVideoCentering();

      forceEndOnTimeupdateIfRequired(event);
    }, this);

    /**
     * Notifies the controller that the play event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePlayEvent
     * @param {object} event The event from the video
     */
    var raisePlayEvent = _.bind(function(event) {
      this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
    }, this);

    /**
     * Notifies the controller that the pause event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePauseEvent
     */
    var raisePauseEvent = _.bind(function() {
      this.controller.notify(this.controller.EVENTS.PAUSED);
      forceEndOnPausedIfRequired();
    }, this);

    /**
     * Notifies the controller that the ratechange event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseRatechangeEvent
     */
    var raiseRatechangeEvent = _.bind(function() {
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    }, this);

    /**
     * Notifies the controller that the volume event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseVolumeEvent
     * @param {object} event The event raised by the video.
     */
    var raiseVolumeEvent = _.bind(function(event) {
      this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { volume: event.target.volume });
    }, this);

    /**
     * Notifies the controller that the fullscreenBegin event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseFullScreenBegin
     * @param {object} event The event raised by the video.
     */
    var raiseFullScreenBegin = _.bind(function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { isFullScreen: true, paused: event.target.paused });
    }, this);

    /**
     * Notifies the controller that the fullscreenEnd event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseFullScreenEnd
     * @param {object} event The event raised by the video.
     */
    var raiseFullScreenEnd = _.bind(function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { "isFullScreen": false, "paused": event.target.paused });
    }, this);


    /************************************************************************************/
    // Helper methods
    /************************************************************************************/

    /**
     * Generates a random string.
     * @private
     * @method OoyalaVideoWrapper#getRandomString
     * @returns {string} A random string
     */
    var getRandomString = function() {
      return Math.random().toString(36).substring(7);
    };

     /**
     * Fix issue with iPad safari browser not properly centering the video
     * @private
     * @method OoyalaVideoWrapper#setVideoCentering
     */
     var setVideoCentering = function() {
       if (OO.isIpad) {
        var videoWidth = _video.videoWidth;
        var videoHeight = _video.videoHeight;
        var playerWidth = playerDimension.width;
        var playerHeight = playerDimension.height;

        // check if video stream dimension was changed, then re-apply video css
        if (videoWidth != videoDimension.width || videoHeight != videoDimension.height) {
          var css = IPAD_CSS_DEFAULT;
          if (videoHeight/videoWidth > playerHeight/playerWidth) {
            css.width = "";
            css.height = "100%";
          } else {
            css.width = "100%";
            css.height = "";
          }
          $(_video).css(css);

          videoDimension.width = videoWidth;
          videoDimension.height = videoHeight;
        }
      }
     };

    /**
     * If any plays are queued up, execute them.
     * @private
     * @method OoyalaVideoWrapper#dequeuePlay
     */
    var dequeuePlay = _.bind(function() {
      if (playQueued) {
        playQueued = false;
        executePlay();
      }
    }, this);

    /**
     * Loads (if required) and plays the current stream.
     * @private
     * @method OoyalaVideoWrapper#executePlay
     */
    var executePlay = _.bind(function() {
      // TODO: Check if no src url is configured?
      if (!loaded) {
        this.load(true);
      }

      _video.play();
      hasPlayed = true;
      videoEnded = false;
    }, this);


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

    /**
     * Converts the desired seek time to a safe seek time based on the duration and platform.  If seeking
     * within OO.CONSTANTS.SEEK_TO_END_LIMIT of the end of the stream, seeks to the end of the stream.
     * @private
     * @method OoyalaVideoWrapper#convertToSafeSeekTime
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
     * @method OoyalaVideoWrapper#getSafeSeekTimeIfPossible
     * @param {object} _video The video element
     * @param {number} time The desired seek-to position
     * @returns {?number} The seek-to position, or null if seeking is not possible
     */
    var getSafeSeekTimeIfPossible = function(_video, time) {
      if ((typeof time !== "number") || !canSeek) {
        return null;
      }

      var range = getSafeSeekRange(_video.seekable);
      if (range.start === 0 && range.end === 0) {
        return null;
      }

      var safeTime = convertToSafeSeekTime(time, _video.duration);
      if (range.start <= safeTime && range.end >= safeTime) {
        return safeTime;
      }

      return null;
    };

    /**
     * Adds the desired seek time to a queue so as to be used later.
     * @private
     * @method OoyalaVideoWrapper#queueSeek
     * @param {number} time The desired seek-to position
     */
    var queueSeek = function(time) {
      queuedSeekTime = time;
    };

    /**
     * If a seek was previously queued, triggers a seek to the queued seek time.
     * @private
     * @method OoyalaVideoWrapper#dequeueSeek
     */
    var dequeueSeek = _.bind(function() {
      if (queuedSeekTime === null) { return; }
      if (this.seek(queuedSeekTime)) { queuedSeekTime = null; }
    }, this);

    /**
     * Notifies the controller of events that provide playhead information.
     * @private
     * @method OoyalaVideoWrapper#raisePlayhead
     */
    var raisePlayhead = _.bind(function(eventname, event) {
      // If the stream is seekable, supress playheads that come before the initialTime has been reached
      // or that come while seeking.
      if (isSeeking || (!!queuedInitialTime &&
          !!getSafeSeekTimeIfPossible(_video, queuedInitialTime))) {
        return;
      }

      var buffer = 0;
      if (event.target.buffered && event.target.buffered.length > 0) {
        buffer = event.target.buffered.end(0); // in sec;
      }

      // durationchange event raises the currentTime as a string
      var resolvedTime = (event && event.target) ? event.target.currentTime : null;
      if (resolvedTime && (typeof resolvedTime !== "number")) {
        resolvedTime = Number(resolvedTime);
      }

      // Safety against accessing seekable before SAFARI browser canPlay media
      if (OO.isSafari && !canPlay) {
        var seekable = getSafeSeekRange(null);
      } else {
        var seekable = getSafeSeekRange(event.target.seekable);
      }

      this.controller.notify(eventname,
                             { "currentTime": resolvedTime,
                               "duration": resolveDuration(event.target.duration),
                               "buffer": buffer,
                               "seekRange": seekable });
    }, this);

    /**
     * Resolves the duration of the video to a valid value.
     * @private
     * @method OoyalaVideoWrapper#resolveDuration
     * @param {number} duration The reported duration of the video in seconds
     * @returns {number} The resolved duration of the video in seconds
     */
    var resolveDuration = function(duration) {
      if (duration === Infinity || isNaN(duration)) {
        return 0;
      }
      return duration;
    };

    /**
     * Safari desktop sometimes doesn't raise the ended event until the next time the video is played.
     * Force the event to come through by calling play if _video.ended to prevent it for coming up on the
     * next stream.
     * @private
     * @method OoyalaVideoWrapper#forceEndOnPausedIfRequired
     */
    var forceEndOnPausedIfRequired = _.bind(function() {
      if (OO.isSafari && !OO.isIos) {
        if (_video.ended) {
          console.log("VTC_OO: Force through the end of stream for Safari", _video.currentSrc,
                      _video.duration, _video.currentTime);
          raiseEndedEvent();
        }
      }
    }, this);

    /**
     * Currently, iOS has a bug that if the m3u8 EXTINF indicates a different duration, the ended event never
     * gets dispatched.  Manually trigger an ended event on all m3u8 streams where duration is a non-whole
     * number.
     * @private
     * @method OoyalaVideoWrapper#forceEndOnTimeupdateIfRequired
     */
    var forceEndOnTimeupdateIfRequired = _.bind(function(event) {
      if (isM3u8) {
        var durationResolved = resolveDuration(event.target.duration);
        var durationInt = Math.floor(durationResolved);
        if ((_video.currentTime == durationResolved) && (durationResolved > durationInt)) {
          console.log("VTC_OO: manually triggering end of stream for m3u8", _currentUrl, durationResolved,
                      _video.currentTime);
          _.defer(raiseEndedEvent);
        }
      }
    }, this);

    /**
     * Chrome does not raise a waiting event when the buffer experiences an underflow and the stream stops
     * playing.  To compensate, start a watcher that periodically checks the currentTime.  If the stream is
     * not advancing but is not paused, raise the waiting event once.
     * If the watcher has already been started, do nothing.
     * @private
     * @method OoyalaVideoWrapper#startUnderflowWatcher
     */
    var startUnderflowWatcher = _.bind(function() {
      if ((OO.isChrome || OO.isIos || OO.isIE11Plus) && !underflowWatcherTimer) {
        var watchInterval = 300;
        underflowWatcherTimer = setInterval(underflowWatcher, watchInterval)
      }
    }, this);

    /**
     * Periodically checks the currentTime.  If the stream is not advancing but is not paused, raise the
     * waiting event once.
     * @private
     * @method OoyalaVideoWrapper#underflowWatcher
     */
    var underflowWatcher = _.bind(function() {
      if (!hasPlayed) {
        return;
      }

      if (_video.ended) {
        return stopUnderflowWatcher();
      }

      if (!_video.paused && _video.currentTime == watcherTime) {
        if (!waitingEventRaised) {
          raiseWaitingEvent();
        }
      } else { // should be able to do this even when paused
        watcherTime = _video.currentTime;
        if (waitingEventRaised) {
          raiseCanPlayThrough();
        }
      }
    }, this);

    /**
     * Stops the interval the watches for underflow.
     * @private
     * @method OoyalaVideoWrapper#stopUnderflowWatcher
     */
    var stopUnderflowWatcher = _.bind(function() {
      clearInterval(underflowWatcherTimer);
      underflowWatcherTimer = null;
      waitingEventRaised = false;
      watcherTime = -1;
    }, this);
  };

  /**
   * @class Platform
   * @classdesc Functions that provide platform information
   */
  var Platform = {
    /**
     * Checks if the player is running on an Android device of version 4 or later.
     * @private
     * @method Platform#isAndroid4Plus
     * @returns {boolean} True if the player is running on an Android device of version 4 or later
     */
    isAndroid4Plus: (function(){
      if (!window.navigator.appVersion.match(/Android/)) return false;
      var device = window.navigator.appVersion.match(/Android [1-9]/) || [];
      return (_.first(device) || "").slice(-1) >= "4";
    })(),
  };

  OO.Video.plugin(new OoyalaVideoFactory());
}(OO._, OO.$));
