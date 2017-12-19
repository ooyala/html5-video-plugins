/*
 * Simple HTML5 video tag plugin for mp4 and hls
 * version: 0.1
 */

require("../../../html5-common/js/utils/InitModules/InitOO.js");
require("../../../html5-common/js/utils/InitModules/InitOOUnderscore.js");
require("../../../html5-common/js/utils/InitModules/InitOOHazmat.js");
require("../../../html5-common/js/utils/constants.js");
require("../../../html5-common/js/utils/utils.js");
require("../../../html5-common/js/utils/environment.js");

(function(_, $) {
  var pluginName = "ooyalaHtml5VideoTech";
  var currentInstances = {};

  /**
   * @class OoyalaVideoFactory
   * @classdesc Factory for creating video player objects that use HTML5 video tags
   * @property {string} name The name of the plugin
   * @property {object} encodings An array of supported encoding types (ex. OO.VIDEO.ENCODING.MP4)
   * @property {object} features An array of supported features (ex. OO.VIDEO.FEATURE.CLOSED_CAPTIONS)
   * @property {string} technology The core video technology (ex. OO.VIDEO.TECHNOLOGY.HTML5)
   */
  var OoyalaVideoFactory = function() {
    this.name = pluginName;

    this.features = [ OO.VIDEO.FEATURE.CLOSED_CAPTIONS,
                      OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE ];
    this.technology = OO.VIDEO.TECHNOLOGY.HTML5;

    // Determine supported encodings
    var getSupportedEncodings = function() {
      var list = [];
      var videoElement = document.createElement("video");

      if (typeof videoElement.canPlayType === "function") {
        if (!!videoElement.canPlayType("video/mp4")) {
          list.push(OO.VIDEO.ENCODING.MP4);
        }

        if (!!videoElement.canPlayType("video/webm")) {
          list.push(OO.VIDEO.ENCODING.WEBM);
        }

        if ((!!videoElement.canPlayType("application/vnd.apple.mpegurl") ||
             !!videoElement.canPlayType("application/x-mpegURL")) &&
            !OO.isSmartTV && !OO.isRimDevice &&
            (!OO.isMacOs || OO.isMacOsLionOrLater)) {
          // 2012 models of Samsung and LG smart TV's do not support HLS even if reported
          // Mac OS must be lion or later
          list.push(OO.VIDEO.ENCODING.HLS);
          list.push(OO.VIDEO.ENCODING.AKAMAI_HD2_VOD_HLS);
          list.push(OO.VIDEO.ENCODING.AKAMAI_HD2_HLS);
        }

        // Sony OperaTV supports HLS but doesn't properly report it so we are forcing it here
        if (window.navigator.userAgent.match(/SonyCEBrowser/)) {
          list.push(OO.VIDEO.ENCODING.HLS);
          list.push(OO.VIDEO.ENCODING.AKAMAI_HD2_VOD_HLS);
          list.push(OO.VIDEO.ENCODING.AKAMAI_HD2_HLS);
        }
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
     * @param {string} playerId An id that represents the player instance
     * @param {object} pluginParams An object containing all of the options set for this plugin
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = function(parentContainer, domId, controller, css, playerId, pluginParams) {
      // If the current player has reached max supported elements, do not create a new one
      if (this.maxSupportedElements > 0 && playerId &&
          currentInstances[playerId] >= this.maxSupportedElements) {
        return;
      }

      var video = $("<video>");
      video.attr("class", "video");
      video.attr("id", domId);

      // [PBW-5470] On Safari, when preload is set to 'none' and the user switches to a
      // different tab while the video is about to auto play, the browser stops playback but
      // doesn't fire a 'pause' event, which causes the player to get stuck in 'buffering' state.
      // Setting preload to 'metadata' (or 'auto') allows Safari to auto resume when the tab is refocused.
      if (OO.isSafari && !OO.isIos) {
        video.attr("preload", "metadata");
      } else {
        video.attr("preload", "none");
      }

      video.css(css);

      if (OO.isIos) {
        // enable airplay for iOS
        // http://developer.apple.com/library/safari/#documentation/AudioVideo/Conceptual/AirPlayGuide/OptingInorOutofAirPlay/OptingInorOutofAirPlay.html
        //
        video.attr("x-webkit-airplay", "allow");

        //enable inline playback for mobile
        if (pluginParams["iosPlayMode"] === "inline") {
          if (OO.iosMajorVersion >= 10) {
            video.attr('playsinline', '');
          }
        }
      }

      // Set initial container dimension
      var dimension = {
        width: parentContainer.width(),
        height: parentContainer.height()
      };

      if (!playerId) {
        playerId = getRandomString();
      }

      var element = new OoyalaVideoWrapper(domId, video[0], dimension, playerId);
      if (currentInstances[playerId] && currentInstances[playerId] >= 0) {
        currentInstances[playerId]++;
      } else {
        currentInstances[playerId] = 1;
      }
      element.controller = controller;
      controller.notify(controller.EVENTS.CAN_PLAY);

      // TODO: Wait for loadstart before calling this?
      element.subscribeAllEvents();

      parentContainer.append(video);

      return element;
    };

    /**
     * Destroys the video technology factory
     * @public
     * @method OoyalaVideoFactory#destroy
     */
    this.destroy = function() {
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
                                        (!OO.isAndroid4Plus || OO.chromeMajorVersion < 40);
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
   * @property {string} playerId An id representing the unique player instance
   */
  var OoyalaVideoWrapper = function(domId, video, dimension, playerId) {
    this.controller = {};
    this.disableNativeSeek = false;

    var _video = video;
    var _playerId = playerId;
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
    var currentTimeShift = 0;
    var currentVolumeSet = 0;
    var isM3u8 = false;
    var TRACK_CLASS = "track_cc";
    var firstPlay = true;
    var playerDimension = dimension;
    var videoDimension = {height: 0, width: 0};
    var initialTime = { value: 0, reached: true };
    var canSeek = true;
    var isPriming = false;
    var isLive = false;
    var lastCueText = null;
    var availableClosedCaptions = {};
    var textTrackModes = {};
    var originalPreloadValue = $(_video).attr("preload") || "none";

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
          canSeek = false;
        }
      }, this);
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
     * @param {string} encoding The encoding of video stream, possible values are found in OO.VIDEO.ENCODING
     * @param {boolean} live True if it is a live asset, false otherwise
     * @returns {boolean} True or false indicating success
     */
    // Allow for the video src to be changed without loading the video
    this.setVideoUrl = function(url, encoding, live) {
      // check if we actually need to change the URL on video tag
      // compare URLs but make sure to strip out the trailing cache buster
      var urlChanged = false;
      if (_currentUrl.replace(/[\?&]_=[^&]+$/,'') != url) {
        _currentUrl = url || "";

        isM3u8 = (encoding == OO.VIDEO.ENCODING.HLS ||
          encoding == OO.VIDEO.ENCODING.AKAMAI_HD2_VOD_HLS ||
          encoding == OO.VIDEO.ENCODING.AKAMAI_HD2_HLS
        );
        isLive = live;
        urlChanged = true;
        resetStreamData();
        if (_currentUrl === "") {
          _video.src = null;
        } else {
          _video.src = _currentUrl;
        }
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
      currentTimeShift = 0;
      videoEnded = false;
      videoDimension = {height: 0, width: 0};
      initialTime = { value: 0, reached: true };
      canSeek = true;
      isPriming = false;
      stopUnderflowWatcher();
      lastCueText = null;
      textTrackModes = {};
      // Restore the preload attribute to the value it had when the video
      // element was created
      $(_video).attr("preload", originalPreloadValue);
      // [PLAYER-212]
      // Closed captions persist across discovery videos unless they are cleared
      // when a new video is set
      $(_video).find('.' + TRACK_CLASS).remove();
      availableClosedCaptions = {};
    }, this);

    /**
     * Callback to handle notifications that ad finished playing
     * @private
     * @method OoyalaVideoWrapper#onAdsPlayed
     */
    this.onAdsPlayed = function() {
    };

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method OoyalaVideoWrapper#load
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = function(rewind) {
      if (loaded && !rewind) return;
      if (!!rewind) {
        if (OO.isEdge) {
          // PBW-4555: Edge browser will always go back to time 0 on load.  Setting time to 0 here would
          // cause the raw video element to enter seeking state.  Additionally, if we call load while seeking
          // on Edge, then seeking no longer works until the video stream url is changed.  Protect against
          // seeking issues using loaded.  Lastly edge always preloads.
          currentTime = 0;
        } else {
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
            OO.log('VTC_OO: Failed to rewind video, probably ok; continuing');
          }
        }
      }
      canPlay = false;
      // The load() method might still be affected by the value of the preload attribute in
      // some browsers (i.e. it might determine how much data is actually loaded). We set preload to auto
      // before loading in case that this.load() was called by VC_PRELOAD. If load() is called prior to
      // starting playback this will be redundant, but it shouldn't cause any issues
      $(_video).attr("preload", "auto");
      _video.load();
      loaded = true;
    };

    /**
     * Sets the initial time of the video playback.  For this plugin that is simply a seek which will be
     * triggered upon 'loadedmetadata' event.
     * @public
     * @method OoyalaVideoWrapper#setInitialTime
     * @param {number} time The initial time of the video (seconds)
     */
    this.setInitialTime = function(time) {
      var canSetInitialTime = (!hasPlayed || videoEnded) && (time !== 0);
      // [PBW-5539] On Safari (iOS and Desktop), when triggering replay after the current browser tab looses focus, the
      // current time seems to fall a few milliseconds behind the video duration, which
      // makes the video play for a fraction of a second and then stop again at the end.
      // In this case we allow setting the initial time back to 0 as a workaround for this
      var initialTimeRequired = OO.isSafari && videoEnded && time === 0;

      if (canSetInitialTime || initialTimeRequired) {
        initialTime.value = time;
        initialTime.reached = false;

        // [PBW-3866] Some Android devices (mostly Nexus) cannot be seeked too early or the seeked event is
        // never raised, even if the seekable property returns an endtime greater than the seek time.
        // To avoid this, save seeking information for use later.
        // [PBW-5539] Same issue with desktop Safari when setting initialTime after video ends
        if (OO.isAndroid || (initialTimeRequired && !OO.isIos)) {
          queueSeek(initialTime.value);
        }
        else {
          this.seek(initialTime.value);
        }
      }
    };

    /**
     * Since there are no standards for error codes or names for play promises,
     * we'll compile a list of errors that represent a user interaction required error.
     * @private
     * @method OoyalaVideoWrapper#userInteractionRequired
     * @param {string} error The error object given by the play promise when it fails
     * @returns {boolean} True if this error represents a user interaction required error, false otherwise
     */
    var userInteractionRequired = function(error) {
      var userInteractionRequired = false;
      if (error) {
        var chromeError = error.name === "NotAllowedError";
        //Safari throws the error "AbortError" for all play promise failures
        //so we'll have to treat all of them the same
        if (!OO.isChrome || chromeError) {
          //There is no requirement for muted autoplay on Firefox,
          //so we'll ignore any Firefox play promise errors
          userInteractionRequired = !OO.isFirefox;
        }
      }

      return userInteractionRequired;
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
        var playPromise = executePlay(false);
        if (playPromise) {
          if (typeof playPromise.catch === 'function') {
            playPromise.catch(_.bind(function(error) {
              if (error) {
                OO.log("Play Promise Failure", error, error.name);
                if (userInteractionRequired(error)) {
                  if (!_video.muted) {
                    this.controller.notify(this.controller.EVENTS.UNMUTED_PLAYBACK_FAILED, {error: error});
                  }
                }
              }
            }, this));
          }
          if (typeof playPromise.then === 'function') {
            playPromise.then(_.bind(function() {
              //playback succeeded
              if (!_video.muted) {
                this.controller.notify(this.controller.EVENTS.UNMUTED_PLAYBACK_SUCCEEDED);
              }
            }, this));
          }
        }
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
      var seekTime;

      if (isLive) {
        var maxTimeShift = getMaxTimeShift();
        // Live videos without DVR can't be seeked
        if (maxTimeShift === 0) {
          return false;
        }
        // Time should be a value from 0 to DVR Window Duration. Adding the value
        // of maxTimeShift (which is the negative of DVR Window Duration) to time will
        // give us the new value of time shift, which will be a negative value.
        var newTimeShift = time + maxTimeShift;
        // Subtract the current time shift from the current time. Since the time shift value
        // is negative, this will add up to the value of the live playhead (i.e. it's equivalent
        // to removing the time shift). We then apply the new time shift to the live playhead in
        // order to shift to the expected position.
        seekTime = (_video.currentTime - currentTimeShift) + newTimeShift;
        // New time shift now becomes the current
        currentTimeShift = newTimeShift;
      } else {
        seekTime = getSafeSeekTimeIfPossible(_video, time);
      }

      if (seekTime !== null) {
        _video.currentTime = seekTime;
        isSeeking = true;
        return true;
      }
      queueSeek(time);
      return false;
    };

    /**
     * Triggers a mute on the video element.
     * @public
     * @method OoyalaVideoWrapper#mute
     */
    this.mute = function() {
      _video.muted = true;

      //the volumechange event is supposed to be fired when video.muted is changed,
      //but it doesn't always fire. Raising a volume event here with the current volume
      //to cover these situations
      raiseVolumeEvent({ target: { volume: _video.volume }});
    };

    /**
     * Triggers an unmute on the video element.
     * @public
     * @method OoyalaVideoWrapper#unmute
     */
    this.unmute = function() {
      _video.muted = false;

      //workaround of an issue where some external SDKs (such those used in ad/video plugins)
      //are setting the volume to 0 when muting
      //Set the volume to our last known setVolume setting.
      //Since we're unmuting, we don't want to set volume to 0
      if (currentVolumeSet > 0) {
        this.setVolume(currentVolumeSet);
      }

      //the volumechange event is supposed to be fired when video.muted is changed,
      //but it doesn't always fire. Raising a volume event here with the current volume
      //to cover these situations
      raiseVolumeEvent({ target: { volume: _video.volume }});
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

      currentVolumeSet = resolvedVolume;

      //  TODO check if we need to capture any exception here. ios device will not allow volume set.
      _video.volume = resolvedVolume;

      // If no video is assigned yet, the volumeChange event is not raised although it takes effect
      if (_video.currentSrc === "" || _video.currentSrc === null) {
        raiseVolumeEvent({ target: { volume: resolvedVolume }});
      }
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
     * Prepares a video element to be played via API.  This is called on a user click event, and is used in
     * preparing HTML5-based video elements on devices.  To prepare the element for playback, call play and
     * pause.  Do not raise playback events during this time.
     * @public
     * @method OoyalaVideoWrapper#primeVideoElement
     */
    this.primeVideoElement = function() {
      // We need to "activate" the video on a click so we can control it with JS later on mobile
      var playPromise = executePlay(true);
      // PLAYER-1323
      // Safar iOS seems to freeze when pausing right after playing when using preloading.
      // On this platform we wait for the play promise to be resolved before pausing.
      if (OO.isIos && playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function() {
          // There is no point in pausing anymore if actual playback has already been requested
          // by the time the promise is resolved
          if (!hasPlayed) {
            _video.pause();
          }
        });
      } else {
        _video.pause();
      }
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
      stopUnderflowWatcher();
      //On IE and Edge, setting the video source to an empty string has the unwanted effect
      //of a network request to the base url
      if (!OO.isIE && !OO.isEdge) {
        _video.src = '';
      }
      unsubscribeAllEvents();
      $(_video).remove();
      if (_playerId && currentInstances[_playerId] && currentInstances[_playerId] > 0) {
        currentInstances[_playerId]--;
      }
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
    this.setClosedCaptions = _.bind(function(language, closedCaptions, params) {
      var iosVersion = OO.iosMajorVersion;
      var macOsSafariVersion = OO.macOsSafariVersion;
      var useOldLogic = (iosVersion && iosVersion < 10) || (macOsSafariVersion && macOsSafariVersion < 10);
      if (useOldLogic) { // XXX HACK! PLAYER-54 iOS and OSX Safari versions < 10 require re-creation of textTracks every time this function is called
        $(_video).find('.' + TRACK_CLASS).remove();
        textTrackModes = {};
        if (language == null) {
          return;
        }
      } else {
        if (language == null) {
          $(_video).find('.' + TRACK_CLASS).remove();
          textTrackModes = {};
          return;
        }
        // Remove captions before setting new ones if they are different, otherwise we may see native closed captions
        if (closedCaptions) {
          $(_video).children('.' + TRACK_CLASS).each(function() {
            if ($(this).label != closedCaptions.locale[language] ||
                $(this).srclang != language ||
                $(this).kind != "subtitles") {
              $(this).remove();
            }
          });
        }
      }

      //Add the new closed captions if they are valid.
      var captionsFormat = "closed_captions_vtt";
      if (closedCaptions && closedCaptions[captionsFormat]) {
        _.each(closedCaptions[captionsFormat], function(captions, languageKey) {
          var captionInfo = {
            label: captions.name,
            src: captions.url,
            language: languageKey,
            inStream: false
          }
          addClosedCaptions(captionInfo);
        });
      }

      var trackId = OO.getRandomString();
      var captionMode = (params && params.mode) || OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING;
      //Set the closed captions based on the language and our available closed captions
      if (availableClosedCaptions[language]) {
        var captions = availableClosedCaptions[language];
        //If the captions are in-stream, we just need to enable them; Otherwise we must add them to the video ourselves.
        if (captions.inStream == true && _video.textTracks) {
          for (var i = 0; i < _video.textTracks.length; i++) {
            if (((OO.isSafari || OO.isEdge) && isLive) || _video.textTracks[i].kind === "captions") {
              _video.textTracks[i].mode = captionMode;
              _video.textTracks[i].oncuechange = onClosedCaptionCueChange;
            } else {
              _video.textTracks[i].mode = OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED;
            }
            // [PLAYER-327], [PLAYER-73]
            // We keep track of all text track modes in order to prevent Safari from randomly
            // changing them. We can't set the id of inStream tracks, so we use a custom
            // trackId property instead
            trackId = _video.textTracks[i].id || _video.textTracks[i].trackId || OO.getRandomString();
            _video.textTracks[i].trackId = trackId;
            textTrackModes[trackId] = _video.textTracks[i].mode;
          }
        } else if (!captions.inStream) {
          this.setClosedCaptionsMode(OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
          if (useOldLogic) { // XXX HACK! PLAYER-54 create video element unconditionally as it was removed
            $(_video).append("<track id='" + trackId + "' class='" + TRACK_CLASS + "' kind='subtitles' label='" + captions.label + "' src='" + captions.src + "' srclang='" + captions.language + "' default>");
            if (_video.textTracks && _video.textTracks[0]) {
              _video.textTracks[0].mode = captionMode;
              //We only want to let the controller know of cue change if we aren't rendering cc from the plugin.
              if (captionMode == OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN) {
                _video.textTracks[0].oncuechange = onClosedCaptionCueChange;
              }
            }
          } else {
            if ($(_video).children('.' + TRACK_CLASS).length == 0) {
              $(_video).append("<track id='" + trackId + "' class='" + TRACK_CLASS + "' kind='subtitles' label='" + captions.label + "' src='" + captions.src + "' srclang='" + captions.language + "' default>");
            }
            if (_video.textTracks && _video.textTracks.length > 0) {
              for (var i = 0; i < _video.textTracks.length; i++) {
                _video.textTracks[i].mode = captionMode;
                //We only want to let the controller know of cue change if we aren't rendering cc from the plugin.
                if (captionMode == OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN) {
                  _video.textTracks[i].oncuechange = onClosedCaptionCueChange;
                }
              }
            }
          }
          // [PLAYER-327], [PLAYER-73]
          // Store mode of newly added tracks for future use in workaround
          textTrackModes[trackId] = captionMode;
          //Sometimes there is a delay before the textTracks are accessible. This is a workaround.
          _.delay(function(captionMode) {
            if (_video.textTracks && _video.textTracks[0]) {
              _video.textTracks[0].mode = captionMode;
              if (OO.isFirefox) {
                for (var i=0; i < _video.textTracks[0].cues.length; i++) {
                  _video.textTracks[0].cues[i].line = 15;
                }
              }
            }
          }, 100, captionMode);
        }
      }
    }, this);

    /**
     * Sets the closed captions mode on the video element.
     * @public
     * @method OoyalaVideoWrapper#setClosedCaptionsMode
     * @param {string} mode The mode to set the text tracks element.
     * One of (OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED, OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN, OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING).
     */
    this.setClosedCaptionsMode = _.bind(function(mode) {
      if (_video.textTracks) {
        for (var i = 0; i < _video.textTracks.length; i++) {
          _video.textTracks[i].mode = mode;
          // [PLAYER-327], [PLAYER-73]
          // Store newly set track mode for future use in workaround
          var trackId = _video.textTracks[i].id || _video.textTracks[i].trackId;
          textTrackModes[trackId] = mode;
        }
      }
      if (mode == OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED) {
        raiseClosedCaptionCueChanged("");
      }
    }, this);

    /**
     * Sets the crossorigin attribute on the video element.
     * @public
     * @method OoyalaVideoWrapper#setCrossorigin
     * @param {string} crossorigin The value to set the crossorigin attribute. Will remove crossorigin attribute if null.
     */
    this.setCrossorigin = function(crossorigin) {
      if (crossorigin) {
        // [PBW-6882]
        // There's a strange bug in Safari on iOS11 that causes CORS errors to be
        // incorrectly thrown when setting the crossorigin attribute after a video has
        // played without it. This usually happens when a video with CC's is played
        // after a preroll that's not using crossorigin.
        // At the time of writing iOS Safari doesn't seem to enforce same origin policy
        // for either HLS manifests/segments or VTT files. We avoid setting crossorigin
        // as a workaround for iOS 11 since it currently appears to not be needed.
        var isIos11 = OO.isIos && OO.iosMajorVersion === 11;

        if (!isIos11) {
          $(_video).attr("crossorigin", crossorigin);
        }
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
      // [PLAYER-327], [PLAYER-73]
      // We need to monitor track change in Safari in order to prevent
      // it from overriding our settings
      if (OO.isSafari && _video && _video.textTracks) {
        _video.textTracks.onchange = onTextTracksChange;
      }
      dequeueSeek();
      isLive = isLive || _video.currentTime === Infinity; // Just in case backend and video metadata disagree about this
      loaded = true;
    }, this);

    /**
     * Fired when there is a change on a text track.
     * @private
     * @method OoyalaVideoWrapper#onTextTracksChange
     * @param {object} event The event from the track change
     */
    var onTextTracksChange = _.bind(function(event) {
      for (var i = 0; i < _video.textTracks.length; i++) {
        var trackId = _video.textTracks[i].id || _video.textTracks[i].trackId;

        if (typeof textTrackModes[trackId] === 'undefined') {
          continue;
        }
        // [PLAYER-327], [PLAYER-73]
        // Safari (desktop and iOS) sometimes randomly switches a track's mode. As a
        // workaround, we force our own value if we detect that we have switched
        // to a mode that we didn't set ourselves
        if (_video.textTracks[i].mode !== textTrackModes[trackId]) {
          OO.log("main_html5: Forcing text track mode for track " + trackId + ". Expected: '"
                + textTrackModes[trackId] + "', received: '" + _video.textTracks[i].mode + "'");

          _video.textTracks[i].mode = textTrackModes[trackId];
        }
      }
    }, this);

    /**
     * Callback for when a closed caption track cue has changed.
     * @private
     * @method OoyalaVideoWrapper#onClosedCaptionCueChange
     * @param {object} event The event from the cue change
     */
    var onClosedCaptionCueChange = _.bind(function(event) {
      var cueText = "";
      if (event && event.currentTarget && event.currentTarget.activeCues) {
        for (var i = 0; i < event.currentTarget.activeCues.length; i++) {
          if (event.currentTarget.activeCues[i].text) {
            cueText += event.currentTarget.activeCues[i].text + "\n";
          }
        }
      }
      raiseClosedCaptionCueChanged(cueText);
    }, this);

    /**
     * Workaround for Firefox only.
     * Check for active closed caption cues and relay them to the controller.
     * @private
     * @method OoyalaVideoWrapper#checkForClosedCaptionsCueChange
     */
    var checkForClosedCaptionsCueChange = _.bind(function() {
      var cueText = "";
      if (_video.textTracks) {
        for (var i = 0; i < _video.textTracks.length; i++) {
          if (_video.textTracks[i].activeCues) {
            for (var j = 0; j < _video.textTracks[i].activeCues.length; j++) {
              if (_video.textTracks[i].activeCues[j].text) {
                cueText += _video.textTracks[i].activeCues[j].text + "\n";
              }
            }
            break;
          }
        }
      }
      raiseClosedCaptionCueChanged(cueText);
    }, this);

    /**
     * Check for in-stream and in manifest closed captions.
     * @private
     * @method OoyalaVideoWrapper#checkForClosedCaptions
     */
    var checkForClosedCaptions = _.bind(function() {
      if (_video.textTracks && _video.textTracks.length > 0) {
        var languages = [];
        for (var i = 0; i < _video.textTracks.length; i++) {
          if (((OO.isSafari || OO.isEdge) && isLive) || _video.textTracks[i].kind === "captions") {
            var captionInfo = {
              language: "CC",
              inStream: true,
              label: "In-Stream"
            };
            //Don't overwrite other closed captions of this language. They have priority.
            if (availableClosedCaptions[captionInfo.language] == null) {
              addClosedCaptions(captionInfo);
            }
          }
        }
      }
    }, this);

    /**
     * Add new closed captions and relay them to the controller.
     * @private
     * @method OoyalaVideoWrapper#addClosedCaptions
     */
    var addClosedCaptions = _.bind(function(captionInfo) {
      //Don't add captions if argument is null or we already have added these captions.
      if (captionInfo == null || captionInfo.language == null || (availableClosedCaptions[captionInfo.language] &&
        availableClosedCaptions[captionInfo.language].src == captionInfo.src)) return;
      availableClosedCaptions[captionInfo.language] = captionInfo;
      raiseCaptionsFoundOnPlaying();
    }, this);

    /**
     * Notify the controller with new available closed captions.
     * @private
     * @method OoyalaVideoWrapper#raiseCaptionsFoundOnPlaying
     */
    var raiseCaptionsFoundOnPlaying = _.bind(function() {
      var closedCaptionInfo = {
        languages: [],
        locale: {}
      }
      _.each(availableClosedCaptions, function(value, key) {
        closedCaptionInfo.languages.push(key);
        closedCaptionInfo.locale[key] = value.label;
      });
      this.controller.notify(this.controller.EVENTS.CAPTIONS_FOUND_ON_PLAYING, closedCaptionInfo);
    }, this);

    /**
     * Notify the controller with new closed caption cue text.
     * @private
     * @method OoyalaVideoWrapper#raiseClosedCaptionCueChanged
     * @param {string} cueText The text of the new closed caption cue. Empty string signifies no active cue.
     */
    var raiseClosedCaptionCueChanged = _.bind(function(cueText) {
      cueText = cueText.trim();
      if (cueText != lastCueText) {
        lastCueText = cueText;
        this.controller.notify(this.controller.EVENTS.CLOSED_CAPTION_CUE_CHANGED, cueText);
      }
    }, this);

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
      // Suppress error code 4 when raised by a video element with a null or empty src
      if (!(code === 4 && ($(event.target).attr("src") === "null" || $(event.target).attr("src") === ""))) {
        this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: code });
      }
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

      //Notify controller of video width and height.
      if (firstPlay) {
        this.controller.notify(this.controller.EVENTS.ASSET_DIMENSION, {width: _video.videoWidth, height: _video.videoHeight});
      }
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
      // Do not raise playback events if the video is priming
      if (isPriming) {
        return;
      }

      this.controller.notify(this.controller.EVENTS.PLAYING);
      startUnderflowWatcher();
      checkForClosedCaptions();

      firstPlay = false;
      canSeek = true;
      isSeeking = false;
      setVideoCentering();
    }, this);

    /**
     * Notifies the controller that a waiting event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseWaitingEvent
     */
    var raiseWaitingEvent = _.bind(function() {
      // WAITING event is not raised if no video is assigned yet
      if (_.isEmpty(_video.currentSrc)) {
        return;
      }
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

      // Do not raise playback events if the video is priming
      // If the stream is seekable, supress seeks that come before or at the time initialTime is been reached
      // or that come while seeking.
      if (!isPriming && initialTime.reached) {
        this.controller.notify(this.controller.EVENTS.SEEKING);
      }
    }, this);

    /**
     * Notifies the controller that a seeked event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseSeekedEvent
     */
    var raiseSeekedEvent = _.bind(function(event) { // Firefox known issue: lack of global event.
      isSeeking = false;

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

      // If the stream is seekable, supress seeks that come before or at the time initialTime is been reached
      // or that come while seeking.
      if (!initialTime.reached) {
        initialTime.reached = true;
      } else {
        this.controller.notify(this.controller.EVENTS.SEEKED);
        raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event); // Firefox and Safari seek from paused state.
      }
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
      initialTime.value = 0;

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

      if (initialTime.value > 0 && (event.target.currentTime >= initialTime.value)) {
        initialTime.value = 0;
      }

      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event);

      // iOS has issues seeking so if we queue a seek handle it here
      dequeueSeek();

      // iPad safari has video centering issue. Unfortunately, HTML5 does not have bitrate change event.
      setVideoCentering();

      //Workaround for Firefox because it doesn't support the oncuechange event on a text track
      if (OO.isFirefox) {
        checkForClosedCaptionsCueChange();
      }

      forceEndOnTimeupdateIfRequired(event);
    }, this);

    /**
     * Notifies the controller that the play event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePlayEvent
     * @param {object} event The event from the video
     */
    var raisePlayEvent = _.bind(function(event) {
      // Do not raise playback events if the video is priming
      if (isPriming) {
        return;
      }

      this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
    }, this);

    /**
     * Notifies the controller that the pause event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePauseEvent
     */
    var raisePauseEvent = _.bind(function() {
      // Do not raise playback events if the video is priming
      if (isPriming) {
        return;
      }
      if (!(OO.isIpad && _video.currentTime === 0)) {
        this.controller.notify(this.controller.EVENTS.PAUSED);
      }
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
      this.controller.notify(this.controller.EVENTS.MUTE_STATE_CHANGE, { muted: _video.muted });
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
        executePlay(false);
      }
    }, this);

    /**
     * Loads (if required) and plays the current stream.
     * @private
     * @method OoyalaVideoWrapper#executePlay
     * @param {boolean} priming True if the element is preparing for device playback
     */
    var executePlay = _.bind(function(priming) {
      isPriming = priming;

      // TODO: Check if no src url is configured?
      if (!loaded) {
        this.load(true);
      }

      var playPromise = _video.play();

      if (!isPriming) {
        hasPlayed = true;
        videoEnded = false;
      }
      return playPromise;
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
     * Gets the seekable object in a way that is safe for all browsers.  This fixes an issue where Safari
     * HLS videos become unseekable if 'seekable' is queried before the stream has raised 'canPlay'.
     * @private
     * @method OoyalaVideoWrapper#getSafeSeekableObject
     * @returns {object?} Either the video seekable object or null
     */
    var getSafeSeekableObject = function() {
      if (OO.isSafari && !canPlay) {
        // Safety against accessing seekable before SAFARI browser canPlay media
        return null;
      } else {
        return _video.seekable;
      }
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

      var range = getSafeSeekRange(getSafeSeekableObject());
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
     * Returns the current time shift offset to the live edge in seconds for DVR-enabled streams.
     * @private
     * @method OoyalaVideoWrapper#getTimeShift
     * @return {Number} The negative value of the current time shift offset, in seconds. Returns 0
     * if currently at the live edge.
     */
    var getTimeShift = function(event) {
      return currentTimeShift;
    };

    /**
     * Returns the max amount of time that the video can be seeked back for DVR-enabled
     * live streams. The value of maxTimeShift is represented as a negative number.
     * @private
     * @method OoyalaVideoWrapper#getMaxTimeShift
     * @return {Number} The maximum amount of seconds that the current video can be seeked back
     * represented as a negative number, or zero, if DVR is not available.
     */
    var getMaxTimeShift = function(event) {
      var seekRange = getSafeSeekRange(getSafeSeekableObject());
      if (!isLive || !seekRange) {
        return 0;
      }
      // Get time shift and convert to negative
      var maxShift = 0;
      maxShift = seekRange.end - seekRange.start;
      maxShift = maxShift > 0 && isFinite(maxShift) ? -maxShift : 0;
      return maxShift;
    };

    /**
     * Notifies the controller of events that provide playhead information.
     * @private
     * @method OoyalaVideoWrapper#raisePlayhead
     */
    var raisePlayhead = _.bind(function(eventname, event) {
      // Do not raise playback events if the video is priming
      if (isPriming) {
        return;
      }
      // If the stream is seekable, supress playheads that come before the initialTime has been reached
      // or that come while seeking.
      // TODO: Check _video.seeking?
      if (isSeeking || initialTime.value > 0) {
        return;
      }

      var buffer = 0;
      var currentTime = null;
      var currentLiveTime = 0;
      var maxTimeShift = getMaxTimeShift();
      var duration = resolveDuration(event.target.duration);

      // Live videos without DVR (i.e. maxTimeShift === 0) are treated as regular
      // videos for playhead update purposes
      if (isLive && maxTimeShift !== 0) {
        currentTime = getTimeShift() - maxTimeShift;
        duration = maxTimeShift !== 0 ? -maxTimeShift : 0;
        buffer = duration;
        // [PBW-5863] The skin displays current time a bit differently when dealing
        // with live video, but we still need to keep track of the actual playhead for analytics purposes
        currentLiveTime = video.currentTime;
      } else {
        if (_video.buffered && _video.buffered.length > 0) {
          buffer = _video.buffered.end(0); // in seconds
        }
        currentTime = _video.currentTime;
      }

      var seekable = getSafeSeekRange(getSafeSeekableObject());
      this.controller.notify(eventname, {
        currentTime: currentTime,
        currentLiveTime: currentLiveTime,
        duration: duration,
        buffer: buffer,
        seekRange: seekable
      });
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
        else if (OO.isSafari && !OO.isIos && isSeeking === true && !_video.ended && Math.round(_video.currentTime) === Math.round(_video.duration))
        {
          this.controller.notify(this.controller.EVENTS.SEEKED);
          videoEnded = true;
          initialTime.value = 0;
          this.controller.notify(this.controller.EVENTS.ENDED);
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
      if ((OO.isChrome || OO.isIos || OO.isIE11Plus || OO.isEdge) && !underflowWatcherTimer) {
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
   * Generates a random string.
   * @private
   * @method getRandomString
   * @returns {string} A random string
   */
  var getRandomString = function() {
    return Math.random().toString(36).substring(7);
  };

  OO.Video.plugin(new OoyalaVideoFactory());
}(OO._, OO.$));
