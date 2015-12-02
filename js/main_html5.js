/*
 * Simple HTML5 video tag plugin for mp4 and hls
 * version: 0.1
 */

(function(_, $) {
  var pluginName = "ooyalaHtml5VideoTech";
  var currentInstances = 0;

  /**
   * @class OoyalaVideoFactory
   * @classdesc Factory for creating video player objects that use HTML5 video tags
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use.  True if elements can be created.
   * @property {object} encodings An array of supported encoding types (ex. hls, mp4)
   */
  var OoyalaVideoFactory = function() {
    this.name = pluginName;

    // This module defaults to ready because no setup or external loading is required
    this.ready = true;

    // Determine supported encodings
    var getSupportedEncodings = function() {
      var videoElement = document.createElement("video");
      var list = ["mp4"];
      if (!Platform.isSafari) {
        list.push("webm");
      }
      if (!!videoElement.canPlayType("application/vnd.apple.mpegurl") ||
          !!videoElement.canPlayType("application/x-mpegURL")) {
        list.push("hls");
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
      if (Platform.isIos) {
        video.attr("x-webkit-airplay", "allow");
      }

      element = new OoyalaVideoWrapper(domId, video[0]);
      currentInstances++;
      element.controller = controller;

      // TODO: Wait for loadstart before calling this?
      element.subscribeAllEvents();

      parentContainer.append(video);

      // On Android, we need to "activate" the video on a click so we can control it with JS later on mobile
      if (Platform.isAndroid) {
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
      var iosRequireSingleElement = Platform.isIos;
      var androidRequireSingleElement = Platform.isAndroid &&
                                        (!Platform.isAndroid4Plus || Platform.chromeMajorVersion < 40);
      return (iosRequireSingleElement || androidRequireSingleElement) ? 1 : -1;
    })();
  };

  /**
   * @class OoyalaVideoWrapper
   * @classdesc Player object that wraps HTML5 video tags
   * @param {string} domId The dom id of the video player element
   * @param {object} video The core video object to wrap
   * @property {object} controller A reference to the Ooyala Video Tech Controller
   * @property {boolean} disableNativeSeek When true, the plugin should supress or undo seeks that come from
   *                                       native video controls
   */
  var OoyalaVideoWrapper = function(domId, video) {
    this.controller = {};
    this.disableNativeSeek = false;

    var _video = video;
    var _currentUrl = '';
    var videoEnded = false;
    var listeners = {};
    var loaded = false;
    var hasPlayed = false;
    var queuedSeekTime = null;
    var playQueued = false;
    var isSeeking = false;
    var currentTime = 0;
    var isM3u8 = false;
    var TRACK_CLASS = "track_cc";
    var firstPlay = true;

    // TODO: These are unused currently
    var _readyToPlay = false; // should be set to true on canplay event

    /************************************************************************************/
    // External Methods that Video Controller or Factory call
    /************************************************************************************/
    /**
     * Subscribes to all events raised by the video element.
     * This is called by the Factory during creation.
     * @public
     * @method OoyalaVideoWrapper#subscribeAllEvents
     */
    this.subscribeAllEvents = function() {
      listeners = { "loadstart": _.bind(onLoadStart, this),
                    "loadedmetadata": _.bind(onLoadedMetadata, this),
                    "progress": _.bind(raiseProgress, this),
                    "error": _.bind(raiseErrorEvent, this),
                    "stalled": _.bind(raiseStalledEvent, this),
                    "canplaythrough": _.bind(raiseCanPlayThrough, this),
                    "playing": _.bind(raisePlayingEvent, this),
                    "waiting": _.bind(raiseWaitingEvent, this),
                    "seeking": _.bind(raiseSeekingEvent, this),
                    "seeked": _.bind(raiseSeekedEvent, this),
                    "ended": _.bind(raiseEndedEvent, this),
                    "durationchange": _.bind(raiseDurationChange, this),
                    "timeupdate": _.bind(raiseTimeUpdate, this),
                    "play": _.bind(raisePlayEvent, this),
                    "pause": _.bind(raisePauseEvent, this),
                    "ratechange": _.bind(raiseRatechangeEvent, this),
                    "volumechange": _.bind(raiseVolumeEvent, this),
                    "volumechangeNew": _.bind(raiseVolumeEvent, this),
                        // ios webkit browser fullscreen events
                    "webkitbeginfullscreen": _.bind(raiseFullScreenBegin, this),
                    "webkitendfullscreen": _.bind(raiseFullScreenEnd, this)
                  };
      // events not used:
      // suspend, abort, emptied, loadeddata, canplay, resize, change, addtrack, removetrack
      _.each(listeners, function(v, i) { $(_video).on(i, v); }, this);
    };

    /**
     * Unsubscribes all events from the video element.
     * This is called by the destroy function.
     * @public
     * @method OoyalaVideoWrapper#unsubscribeAllEvents
     */
    this.unsubscribeAllEvents = function() {
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
        if (_currentUrl.length > 0 && Platform.isChrome) {
          _currentUrl = _currentUrl + (/\?/.test(_currentUrl) ? "&" : "?") + "_=" + getRandomString();
        }

        isM3u8 = (_currentUrl.toLowerCase().indexOf("m3u8") > 0);
        _readyToPlay = false;
        urlChanged = true;
        resetStreamData();
        _video.src = _currentUrl;
      }

      if (_.isEmpty(url)) {
        this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: 0 }); //0 -> no stream
      }

      return urlChanged;
    };

    var resetStreamData = _.bind(function() {
      playQueued = false;
      hasPlayed = false;
      loaded = false;
      videoEnded = false;
    }, this);

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method OoyalaVideoWrapper#load
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = function(rewind) {
      if (loaded && !rewind) return;
      if (!!rewind) {
        try {
          if (Platform.isIos && Platform.iosMajorVersion == 8) {
            // On iOS, wait for durationChange before setting currenttime
            $(_video).on("durationchange", _.bind(function() {
                                                               _video.currentTime = 0;
                                                             }, this));
          } else {
            _video.currentTime = 0;
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
      if (!hasPlayed) {
        this.seek(initialTime);
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
      //  TODO check if we need to capture any exception here. ios device will not allow volume set.
      _video.volume = volume;
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
    };

    /**
     * Destroys the individual video element.
     * @public
     * @method OoyalaVideoWrapper#destroy
     */
    this.destroy = function() {
      _video.pause();
      _video.src = '';
      this.unsubscribeAllEvents();
      $(_video).remove();
      currentInstances--;
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
      if (Platform.isSafari && _video.textTracks.length !== 0) {
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
          }, 10);
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
    var onLoadStart = function() {
      _currentUrl = _video.src;
      firstPlay = true;
      videoEnded = false;
    };

    var onLoadedMetadata = function() {
      dequeueSeek();
    };

    /**
     * Notifies the controller that a progress event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseProgress
     * @param {object} event The event from the video
     */
    var raiseProgress = function(event) {
      var buffer = 0;
      if (event.target.buffered && event.target.buffered.length > 0) {
        buffer = event.target.buffered.end(0); // in sec;
      }
      this.controller.notify(this.controller.EVENTS.PROGRESS,
                             { "currentTime": event.target.currentTime,
                               "duration": resolveDuration(event.target.duration),
                               "buffer": buffer,
                               "seekRange": getSafeSeekRange(event.target.seekable),
                               "url": event.target.src });
    };

    /**
     * Notifies the controller that an error event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseErrorEvent
     * @param {object} event The event from the video
     */
    var raiseErrorEvent = function(event) {
      var code = event.target.error ? event.target.error.code : -1;
      this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: code });
    };

    /**
     * Notifies the controller that a stalled event was raised.  Pauses the video on iPad if the currentTime is 0.
     * @private
     * @method OoyalaVideoWrapper#raiseStalledEvent
     * @param {object} event The event from the video
     */
    var raiseStalledEvent = function(event) {
      // Fix multiple video tag error in iPad
      if (Platform.isIpad && event.target.currentTime === 0) {
        _video.pause();
      }

      this.controller.notify(this.controller.EVENTS.STALLED);
    };

    /**
     * Notifies the controller that a buffered event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseCanPlayThrough
     */
    var raiseCanPlayThrough = function() {
      this.controller.notify(this.controller.EVENTS.BUFFERED, {"url":_video.currentSrc});
    };

    /**
     * Notifies the controller that a playing event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePlayingEvent
     */
    var raisePlayingEvent = function() {
      this.controller.notify(this.controller.EVENTS.PLAYING);
      firstPlay = false;

      //Check for live closed captions and notify controller
      if (firstPlay && _video.textTracks && _video.textTracks.length > 0) {
        var languages = [];
        for (var i = 0; i < _video.textTracks.length; i++) {
          if (_video.textTracks[i].kind === "captions") {
            this.controller.notify(this.controller.EVENTS.CAPTIONS_FOUND_ON_PLAYING);
          }
        }
      }
    };

    /**
     * Notifies the controller that a waiting event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseWaitingEvent
     */
    var raiseWaitingEvent = function() {
      this.controller.notify(this.controller.EVENTS.WAITING, {"url":_video.currentSrc});
    };

    /**
     * Notifies the controller that a seeking event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseSeekingEvent
     */
    var raiseSeekingEvent = function() {
      isSeeking = true;
      this.controller.notify(this.controller.EVENTS.SEEKING);
    };

    /**
     * Notifies the controller that a seeked event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseSeekedEvent
     */
    var raiseSeekedEvent = function() {
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
    };

    /**
     * Notifies the controller that a ended event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseEndedEvent
     */
    var raiseEndedEvent = _.bind(function(event) {
      if (!_video.ended && Platform.isIos) {
        // iOS raises ended events sometimes when a new stream is played in the same video element
        // Prevent this faulty event from making it to the player message bus
        // Desktop Safari, however, will raise this event while ended == false and we shouldn't block it.
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
    var raiseDurationChange = function(event) {
      raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
    };

    /**
     * Notifies the controller that the time position has changed.  Handles seeks if seeks were enqueued and
     * the stream has become seekable.  Triggers end of stream for m3u8 if the stream won't raise it itself.
     * @private
     * @method OoyalaVideoWrapper#raiseTimeUpdate
     * @param {object} event The event from the video
     */
    var raiseTimeUpdate = function(event) {
      if (!isSeeking) {
        currentTime = _video.currentTime;
      }
      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event);

      // iOS has issues seeking so if we queue a seek handle it here
      dequeueSeek();

      forceEndOnTimeupdateIfRequired(event);
    };

    /**
     * Notifies the controller that the play event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePlayEvent
     * @param {object} event The event from the video
     */
    var raisePlayEvent = function(event) {
      this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
    };

    /**
     * Notifies the controller that the pause event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePauseEvent
     */
    var raisePauseEvent = function() {
      this.controller.notify(this.controller.EVENTS.PAUSED);
      forceEndOnPausedIfRequired();
    };

    /**
     * Notifies the controller that the ratechange event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseRatechangeEvent
     */
    var raiseRatechangeEvent = function() {
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    };

    /**
     * Notifies the controller that the volume event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseVolumeEvent
     * @param {object} event The event raised by the video.
     */
    var raiseVolumeEvent = function(event) {
      this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { volume: event.target.volume });
    };

    /**
     * Notifies the controller that the fullscreenBegin event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseFullScreenBegin
     * @param {object} event The event raised by the video.
     */
    var raiseFullScreenBegin = function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { isFullScreen: true, paused: event.target.paused });
    };

    /**
     * Notifies the controller that the fullscreenEnd event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseFullScreenEnd
     * @param {object} event The event raised by the video.
     */
    var raiseFullScreenEnd = function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { "isFullScreen": false, "paused": event.target.paused });
    };


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
      if (Platform.isIpad && safeTime < 0.1) {
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
      var buffer = 0;
      if (event.target.buffered && event.target.buffered.length > 0) {
        buffer = event.target.buffered.end(0); // in sec;
      }
      this.controller.notify(eventname,
                             { "currentTime": event.target.currentTime,
                               "duration": resolveDuration(event.target.duration),
                               "buffer": buffer,
                               "seekRange": getSafeSeekRange(event.target.seekable) });
    }, this);

    /**
     * Resolves the duration of the video to a valid value.
     * @private
     * @method OoyalaVideoWrapper#raisePlayhead
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
      if (Platform.isSafari && !Platform.isIos) {
        if (_video.ended) {
          console.log("VTC_OO: Force through the end of stream for Safari", _video.currentSrc,
                      _video.duration, _video.currentTime);
          _video.play();
          _video.pause();
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
     * @returns {boolean} True if the player is running in Safari
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
      if (!window.navigator.appVersion.match(/Android/)) return false;
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

  OO.Video.plugin(new OoyalaVideoFactory());
}(OO._, OO.$));
