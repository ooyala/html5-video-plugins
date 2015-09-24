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
   * @property {array} streams A list of supported encoding types (ex. m3u8, mp4)
   */
  OoyalaVideoFactory = function() {
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
     * @param {object} parentContainer The div that should act as the parent for the video element
     * @param {string} stream The url of the stream to play
     * @param {string} id The id of the video player instance to create
     * @param {object} controller A reference to the video controller in the Ooyala player
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = function(parentContainer, stream, id, controller) {
      var video = $("<video>");
      video.attr("class", "video");
      video.attr("preload", "none");
      video.attr("crossorigin", "anonymous");
      if (platform.isIos) {
        video.attr("x-webkit-airplay", "allow");
      }
      video.attr("style", "width:100%;height:100%");

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
  OoyalaVideoWrapper = function(id, video) {
    this.streams = [];
    this.controller = {};

    var _id = id;
    var _video = video;
    var _currentUrl = '';
    var videoEnded = false;
    var listeners = {};
    var loaded = false;

    // TODO: These are unused currently
    var _readyToPlay = false; // should be set to true on canplay event
    var isM3u8 = false;

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
                    "webkitendfullscreen": _.bind(raiseFullScreenEnd, this),
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
      if (_currentUrl.replace(/[\?\&]_=[^&]+$/,'') != url) {
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
      _video.currentTime = safeSeekTime(time);
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
      var seekRange = event.target.seekable;
      seekRange = { start : seekRange.length > 0 ? seekRange.start(0) : 0,
                    end : seekRange.length > 0 ? seekRange.end(0) : 0 };
      this.controller.notify(this.controller.EVENTS.PROGRESS,
                             { "currentTime": event.target.currentTime,
                               "duration": event.target.duration,
                               "buffer": buffer,
                               "seekRange": seekRange,
                               "url": event.target.src });
    };

    var raiseErrorEvent = function(event) {
      var code = event.target.error ? event.target.error.code : -1;
      /*
      if (this._emitErrors) {
        this._emitError(event, code);
      } else {
        // The error occurred when the page was probably unloading.
        // Happens more often on low bandwith.
        OO.d("Error not emitted: " + event.type);
        this._unemittedErrors.push({error: event, code: code});
        //this.mb.publish(OO.EVENTS.PAGE_PROBABLY_UNLOADING);
      }
      */

      this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: code });
    };

    var raiseStalledEvent = function(event) {
      // Fix multiple video tag error in iPad
      if (platform.isIpad && event.target.currentTime === 0) {
        _video.pause();
      }

      this.controller.notify(this.controller.EVENTS.STALLED);
    };

    var raiseCanPlayThrough = function(event) {
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

    var raiseEndedEvent = function(event) {
      if (videoEnded) { return; } // no double firing ended event.
      videoEnded = true;

      this.controller.notify(this.controller.EVENTS.ENDED, event.target.src);
    };

    var raiseDurationChange = function(event) {
      raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
    };

    var raiseTimeUpdate = function(event) {
      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event);
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

    var safeSeekTime = _.bind(function(time) {
      // If seeking within some threshold of the end of the stream, seek to end of stream directly
      // TODO: populate OO.CONSTANTS.SEEK_TO_END_LIMIT somehow
      //if (_video.duration - time < OO.CONSTANTS.SEEK_TO_END_LIMIT) { time = _video.duration; }

      var safeTime = time >= _video.duration ? _video.duration - 0.01 : (time < 0 ? 0 : time);
      // iPad with 6.1 has an intersting bug that causes the video to break if seeking exactly to zero
      if (platform.isIpad && safeTime < 0.1) { safeTime = 0.1; }
      return safeTime;
    }, this);

    var raisePlayhead = _.bind(function(eventname, event) {
      var buffer = 0;
      if (event.target.buffered && event.target.buffered.length > 0) {
        buffer = event.target.buffered.end(0); // in sec;
      }
      var seekRange = event.target.seekable;
      seekRange = { start : seekRange.length > 0 ? seekRange.start(0) : 0,
                    end : seekRange.length > 0 ? seekRange.end(0) : 0 };
      this.controller.notify(this.controller.EVENTS.TIME_UPDATE,
                             { "currentTime": event.target.currentTime,
                               "duration": event.target.duration,
                               "buffer": buffer,
                               "seekRange": seekRange });
    }, this);
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
    })(),
  };

  return new OoyalaVideoFactory();
}(OO._, OO.$)));
