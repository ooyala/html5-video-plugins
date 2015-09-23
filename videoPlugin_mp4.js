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
     * @param {object} parentContainer
     * @param {string} stream The url of the stream to play
     * @param {string} id The id of the video player instance to create
     * @param {object} controller A reference to the video controller in the Ooyala player
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
      element.setVideoUrl(stream);
      element.subscribeAllEvents();

      parentContainer.append(video);
      return element;
    };

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
   * @property {string} _id The id of the video player element
   * @property {object} _video The core video object
   * @property {string} _currentUrl The url of the current video stream
   */
  OoyalaVideoWrapper = function(id, video) {
    this._id = id;
    this._video = video;
    this._currentUrl = '';
    var isM3u8 = false;
    this._readyToPlay = false;
    var videoEnded = false;
    var listeners = {};
    this.controller = {};

    /************************************************************************************/
    // Required. Methods that Video Controller or Factory call
    /************************************************************************************/
    this.subscribeAllEvents = function() {
      // events minimum set
      listeners = { "play": _.bind(raisePlayEvent, this),
                    "playing": _.bind(raisePlayingEvent, this),
                    "ended": _.bind(raiseEndedEvent, this),
                    "error": _.bind(raiseErrorEvent, this),
                    "seeking": _.bind(raiseSeekingEvent, this),
                    "seeked": _.bind(raiseSeekedEvent, this),
                    "pause": _.bind(raisePauseEvent, this),
                    "ratechange": _.bind(raiseRatechangeEvent, this),
                    "stalled": _.bind(raiseStalledEvent, this),
                    "volumechange": _.bind(raiseVolumeEvent, this),
                    "volumechangeNew": _.bind(raiseVolumeEvent, this),
                    "waiting": _.bind(raiseWaitingEvent, this),
                    "timeupdate": _.bind(raiseTimeUpdate, this),
                    "durationchange": _.bind(raiseDurationChange, this),
                    "progress": _.bind(raiseProgress, this),
                    "canplaythrough": _.bind(raiseCanPlayThrough, this),
                        // ios webkit browser fullscreen events
                    "webkitbeginfullscreen": _.bind(raiseFullScreenBegin, this),
                    "webkitendfullscreen": _.bind(raiseFullScreenEnd, this),
                  };
      // events not used:
      // suspend, play, pause, loadstart, loadedmetadata, loadeddata, emptied,
      // canplaythrough, canplay, abort
      _.each(listeners, function(v, i) { $(this._video).on(i, v); }, this);
    };

    this.unsubscribeAllEvents = function() {
      _.each(listeners, function(v, i) { $(this._video).off(i, v); }, this);
    };

    // Allow for the video src to be changed without loading the video
    // @param url: the new url to insert into the video element's src attribute
    this.setVideoUrl = function(url) {
      // check if we actually need to change the URL on video tag
      // compare URLs but make sure to strip out the trailing cache buster
      var urlChanged = false;
      if (this._currentUrl.replace(/[\?\&]_=[^&]+$/,'') != url) {
        this._currentUrl = url || "";

        // bust the chrome stupid caching bug
        if(this._currentUrl.length > 0 && platform.isChrome) {
          this._currentUrl = this._currentUrl + (/\?/.test(this._currentUrl) ? "&" : "?") + "_=" + getRandomString();
        }

        isM3u8 = (this._currentUrl.toLowerCase().indexOf("m3u8") > 0);
        this._readyToPlay = false;
        urlChanged = true;
        this._video.src = this._currentUrl;
      }

      // if(_.isEmpty(url)) {
      //   this.trigger(OO.VideoElementWrapper.ERROR, 0); //0 -> no stream
      // }
      return urlChanged;
    };

    this.load = function(rewind) {
      // if(!!rewind) {
      //   try {
      //     if (platform.isIos && OO.iosMajorVersion == 8) {
      //       $(this._video).one("durationchange", _.bind(function() {
      //         this._video.currentTime = 0;}, this));
      //     } else {
      //       this._video.currentTime = 0;
      //     }
      //     this._video.pause();
      //   } catch (ex) {
      //     // error because currentTime does not exist because stream hasn't been retrieved yet
      //     OO.log('Failed to rewind video, probably ok');
      //   }
      // }
      this._video.load();
    };

    this.play = function() {
      this._video.play();
    };

    this.pause = function() {
      this._video.pause();
    };

    this.seek = function(time) {
      this._video.currentTime = safeSeekTime(time);
    };

    this.setVolume = function(volume) {
      //  TODO check if we need to capture any exception here. ios device will not allow volume set.
      this._video.volume = volume;
    };

    this.destroy = function() {
      this._video.pause();
      this._video.src = '';
      this.unsubscribeAllEvents();
      $(this._video).remove();
    };


    // **********************************************************************************/
    // Event callback methods
    // **********************************************************************************/

    var raisePlayEvent = function(event) {
      this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
    };

    var raisePlayingEvent = function() {
      this.controller.notify(this.controller.EVENTS.PLAYING);
    };

    var raiseEndedEvent = function(event) {
      if (videoEnded) { return; } // no double firing ended event.
      videoEnded = true;

      this.controller.notify(this.controller.EVENTS.ENDED, event.target.src);
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

    var raiseSeekingEvent = function() {
      this.controller.notify(this.controller.EVENTS.SEEKING);
    };

    var raiseSeekedEvent = function() {
      this.controller.notify(this.controller.EVENTS.SEEKED);
    };

    var raisePauseEvent = function() {
      this.controller.notify(this.controller.EVENTS.PAUSED);
    };

    var raiseRatechangeEvent = function() {
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    };

    var raiseStalledEvent = function(event) {
      // Fix multiple video tag error in iPad
      if (platform.isIpad && event.target.currentTime === 0) {
        this._video.pause();
      }

      this.controller.notify(this.controller.EVENTS.STALLED);
    };

    var raiseVolumeEvent = function(event) {
      this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { volume: event.target.volume });
    };

    var raiseWaitingEvent = function() {
      videoEnded = false;
      this.controller.notify(this.controller.EVENTS.WAITING);
    };

    var raiseTimeUpdate = function(event) {
      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event);
    };

    var raiseDurationChange = function(event) {
      raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
    };

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

    var raiseCanPlayThrough = function(event) {
      this.controller.notify(this.controller.EVENTS.BUFFERED);
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
      //if (this._video.duration - time < OO.CONSTANTS.SEEK_TO_END_LIMIT) { time = this._video.duration; }

      var safeTime = time >= this._video.duration ? this._video.duration - 0.01 : (time < 0 ? 0 : time);
      // iPad with 6.1 has an intersting bug that causes the video to break if seeking exactly to zero
      if (platform.isIpad && safeTime < 0.1) { safeTime = 0.1; }
      return safeTime;
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
  }

  return new OoyalaVideoFactory();
}(OO._, OO.$)));
