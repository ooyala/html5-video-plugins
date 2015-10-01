/*
 * Simple HTML5 video tag plugin for mp4 and hls
 * version: 0.1
 */

OO.Video.plugin((function(_, $) {
  var pluginName = "ooyalaHtml5VideoTech";

  /**
   * @class OoyalaVideoFactory
   * @classdesc Factory for creating video player objects that use HTML5 video tags
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use.  True if elements can be created.
   * @property {object} streams An array of supported encoding types (ex. m3u8, mp4)
   */
  var OoyalaVideoFactory = function() {
    this.name = pluginName;

    // This module defaults to ready because no setup or external loading is required
    this.ready = true;

    // Determine supported stream types
    var videoElement = document.createElement("video");
    this.streams = (!!videoElement.canPlayType("application/vnd.apple.mpegurl") || !!videoElement.canPlayType("application/x-mpegURL")) ? ["m3u8", "mp4"] : ["mp4"];
    videoElement = null;

    /**
     * Creates a video player instance using OoyalaVideoWrapper
     * @public
     * @method OoyalaVideoFactory#create
     * @memberOf OoyalaVideoFactory
     * @param {object} parentContainer The jquery div that should act as the parent for the video element
     * @param {string} stream The url of the stream to play
     * @param {string} id The id of the video player instance to create
     * @param {object} controller A reference to the video controller in the Ooyala player
     * @param {object} css The css to apply to the video element
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = function(parentContainer, stream, id, controller, css) {
      var video = $("<video>");
      video.attr("class", "video");
      video.attr("preload", "none");
      video.attr("crossorigin", "anonymous");
      video.css(css);

      // enable airplay for iOS
      // http://developer.apple.com/library/safari/#documentation/AudioVideo/Conceptual/AirPlayGuide/OptingInorOutofAirPlay/OptingInorOutofAirPlay.html
      if (platform.isIos) {
        video.attr("x-webkit-airplay", "allow");
      }

      element = new OoyalaVideoWrapper(id, video[0]);
      element.streams = this.streams;
      element.controller = controller;

      // TODO: Wait for loadstart before calling these?
      element.setVideoUrl(stream);
      element.subscribeAllEvents();

      parentContainer.append(video);
      return element;
    };

    /**
     * Destroys the video technology factory
     * @public
     * @method OoyalaVideoFactory#destroy
     * @memberOf OoyalaVideoFactory
     */
    this.destroy = function() {
      this.ready = false;
      this.streams = [];
      this.create = function() {};
    };
  };

  /**
   * @class OoyalaVideoWrapper
   * @classdesc Player object that wraps HTML5 video tags
   * @param {string} id The id of the video player element
   * @param {object} video The core video object to wrap
   * @property {object} streams A list of the stream supported by this video element
   * @property {object} controller A reference to the Ooyala Video Tech Controller
   */
  var OoyalaVideoWrapper = function(id, video) {
    this.streams = [];
    this.controller = {};

    var _video = video;
    var _currentUrl = '';
    var videoEnded = false;
    var listeners = {};
    var loaded = false;
    var queuedSeekTime = null;
    var isM3u8 = false;

    // TODO: These are unused currently
    var _readyToPlay = false; // should be set to true on canplay event

    /************************************************************************************/
    // Required. Methods that Video Controller or Factory call
    /************************************************************************************/
    /**
     * Subscribes to all events raised by the video element.
     * This is called by the Factory during creation.
     * @public
     * @method OoyalaVideoWrapper#subscribeAllEvents
     * @memberOf OoyalaVideoWrapper
     */
    this.subscribeAllEvents = function() {
      listeners = { "loadstart": _.bind(onLoadStart, this),
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
      // suspend, abort, emptied, loadedmetadata, loadeddata, canplay, resize, change, addtrack, removetrack
      _.each(listeners, function(v, i) { $(_video).on(i, v); }, this);
    };

    /**
     * Unsubscribes all events from the video element.
     * This is called by the destroy function.
     * @public
     * @method OoyalaVideoWrapper#unsubscribeAllEvents
     * @memberOf OoyalaVideoWrapper
     */
    this.unsubscribeAllEvents = function() {
      _.each(listeners, function(v, i) { $(_video).off(i, v); }, this);
    };

    /**
     * Sets the url of the video.
     * @public
     * @method OoyalaVideoWrapper#setVideoUrl
     * @memberOf OoyalaVideoWrapper
     * @param {string} url The new url to insert into the video element's src attribute
     * @returns {boolean} True or false indicating success
     */
    // Allow for the video src to be changed without loading the video
    // @param url: the new url to insert into the video element's src attribute
    this.setVideoUrl = function(url) {
      // check if we actually need to change the URL on video tag
      // compare URLs but make sure to strip out the trailing cache buster
      var urlChanged = false;
      if (_currentUrl.replace(/[\?&]_=[^&]+$/,'') != url) {
        _currentUrl = url || "";

        // bust the chrome caching bug
        if (_currentUrl.length > 0 && platform.isChrome) {
          _currentUrl = _currentUrl + (/\?/.test(_currentUrl) ? "&" : "?") + "_=" + getRandomString();
        }

        isM3u8 = (_currentUrl.toLowerCase().indexOf("m3u8") > 0);
        _readyToPlay = false;
        urlChanged = true;
        _video.src = _currentUrl;
      }

      if (_.isEmpty(url)) {
        this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: 0 }); //0 -> no stream
      }

      return urlChanged;
    };

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method OoyalaVideoWrapper#load
     * @memberOf OoyalaVideoWrapper
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = function(rewind) {
      if (loaded && !rewind) return;
      if (!!rewind) {
        try {
          if (platform.isIos && platform.iosMajorVersion == 8) {
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
     * Triggers playback on the video element.
     * @public
     * @method OoyalaVideoWrapper#play
     * @memberOf OoyalaVideoWrapper
     */
    this.play = function() {
      _video.play();
      loaded = true;
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method OoyalaVideoWrapper#pause
     * @memberOf OoyalaVideoWrapper
     */
    this.pause = function() {
      _video.pause();
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method OoyalaVideoWrapper#seek
     * @memberOf OoyalaVideoWrapper
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
     * @memberOf OoyalaVideoWrapper
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = function(volume) {
      //  TODO check if we need to capture any exception here. ios device will not allow volume set.
      _video.volume = volume;
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
     * Destroys the individual video element
     * @public
     * @method OoyalaVideoWrapper#destroy
     * @memberOf OoyalaVideoWrapper
     */
    this.destroy = function() {
      _video.pause();
      _video.src = '';
      this.unsubscribeAllEvents();
      $(_video).remove();
    };


    // **********************************************************************************/
    // Event callback methods
    // **********************************************************************************/

    var onLoadStart = function() {
      _currentUrl = _video.src;
    };

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

    var raiseErrorEvent = function(event) {
      var code = event.target.error ? event.target.error.code : -1;
      this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: code });
    };

    var raiseStalledEvent = function(event) {
      // Fix multiple video tag error in iPad
      if (platform.isIpad && event.target.currentTime === 0) {
        _video.pause();
      }

      this.controller.notify(this.controller.EVENTS.STALLED);
    };

    var raiseCanPlayThrough = function() {
      this.controller.notify(this.controller.EVENTS.BUFFERED);
    };

    var raisePlayingEvent = function() {
      this.controller.notify(this.controller.EVENTS.PLAYING);
    };

    var raiseWaitingEvent = function() {
      videoEnded = false;
      this.controller.notify(this.controller.EVENTS.WAITING);
    };

    var raiseSeekingEvent = function() {
      this.controller.notify(this.controller.EVENTS.SEEKING);
    };

    var raiseSeekedEvent = function() {
      this.controller.notify(this.controller.EVENTS.SEEKED);
    };

    var raiseEndedEvent = function() {
      if (videoEnded) { return; } // no double firing ended event.
      videoEnded = true;

      this.controller.notify(this.controller.EVENTS.ENDED);
    };

    var raiseDurationChange = function(event) {
      raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
    };

    var raiseTimeUpdate = function(event) {
      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event);

      // iOS has issues seeking so if we queue a seek handle it here
      dequeueSeek();

      // This is a hack fix for m3u8, current iOS has a bug that if the m3u8 EXTINF indication a different
      // duration, the ended event never got dispatched. Monkey patch here to manual trigger an ended event
      // need to wait OTS to fix their end.
      if (this.isM3u8) {
        var duration = resolveDuration(event.target.duration);
        var durationInt = Math.floor(duration);
        if ((_video.currentTime == duration) && (duration > durationInt)) {
          console.log("VTC_OO: manually triggering end of stream for m3u8", _currentUrl, duration,
                      _video.currentTime);
          _.defer(raiseEndedEvent, this, event);
        }
      }
    };

    var raisePlayEvent = function(event) {
      this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
    };

    var raisePauseEvent = function() {
      this.controller.notify(this.controller.EVENTS.PAUSED);
    };

    var raiseRatechangeEvent = function() {
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    };

    var raiseVolumeEvent = function(event) {
      this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { volume: event.target.volume });
    };

    var raiseFullScreenBegin = function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { isFullScreen: true, paused: event.target.paused });
    };

    var raiseFullScreenEnd = function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                             { "isFullScreen": false, "paused": event.target.paused });
    };


    /************************************************************************************/
    // Helper methods
    /************************************************************************************/

    var getRandomString = function() {
      return Math.random().toString(36).substring(7);
    };

    var getSafeSeekRange = function(seekRange) {
      if (!seekRange || !seekRange.length || !(typeof seekRange.start == "function") ||
          !(typeof seekRange.end == "function" )) {
        return { "start" : 0, "end" : 0 };
      }

      return { "start" : seekRange.length > 0 ? seekRange.start(0) : 0,
               "end" : seekRange.length > 0 ? seekRange.end(0) : 0 };
    };

    var convertToSafeSeekTime = function(time, duration) {
      // If seeking within some threshold of the end of the stream, seek to end of stream directly
      if (duration - time < OO.CONSTANTS.SEEK_TO_END_LIMIT) {
        time = duration;
      }

      var safeTime = time >= duration ? duration - 0.01 : (time < 0 ? 0 : time);

      // iPad with 6.1 has an interesting bug that causes the video to break if seeking exactly to zero
      if (platform.isIpad && safeTime < 0.1) {
        safeTime = 0.1;
      }
      return safeTime;
    };

    // Returns null if the position cannot be seeked to, and returns the safe time to seek to if it can.
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

    var queueSeek = function(time) {
      queuedSeekTime = time;
    };

    var dequeueSeek = _.bind(function() {
      if (queuedSeekTime === null) { return; }
      if (this.seek(queuedSeekTime)) { queuedSeekTime = null; }
    }, this);

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

    var resolveDuration = function(duration) {
      if (duration === Infinity || isNaN(duration)) {
        return 0;
      }
      return duration; // in seconds;
    };
  };

  // Platform
  var platform = {
    isIos: (function() {
      var platform = window.navigator.platform;
      return !!(platform.match(/iPhone/) || platform.match(/iPad/) || platform.match(/iPod/));
    })(),

    isIpad: (function() {
      return !!window.navigator.platform.match(/iPad/);
    })(),

    isChrome: (function() {
      return !!window.navigator.userAgent.match(/Chrome/);
    })(),

    iosMajorVersion: (function(){
      try {
        if (window.navigator.userAgent.match(/(iPad|iPhone|iPod)/)) {
          return parseInt(window.navigator.userAgent.match(/OS (\d+)/)[1], 10);
        } else {
          return null;
        }
      } catch(err) {
        return null;
      }
    })()
  };

  return new OoyalaVideoFactory();
}(OO._, OO.$)));
