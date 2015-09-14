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

    var videoElement = document.createElement("video");
    this.streams = (!!videoElement.canPlayType("application/vnd.apple.mpegurl") || !!videoElement.canPlayType("application/x-mpegURL")) ? ["m3u8", "mp4"] : ["mp4"];

    /**
     * Creates a video player instance using OoyalaVideoWrapper
     * @public
     * @method OoyalaVideoFactory#create
     * @memberOf OoyalaVideoFactory
     * @param {object} parentContainer
     * @param {string} stream The url of the stream to play
     * @param {string} id The id of the video player instance to create
     */
    this.create = function(parentContainer, stream, id) {
      var video = $("<video>");
      video.attr("class", "video");
      video.attr("preload", "none");
      video.attr("crossorigin", "anonymous");
      if (platform.isIos) {
        video.attr("x-webkit-airplay", "allow");
      }
      video.attr("style", "width:100%;height:100%");

      element = new OoyalaVideoWrapper(id, video[0]);
      element.setVideoUrl(stream);
      element.streams = this.streams;

      parentContainer.append(video);
      return element;
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

    /************************************************************************************/
    // Required. Methods that Video Controller calls
    /************************************************************************************/
    this.subscribeAllEvents = function(callback) {


      // events minimum set
      this._video.addEventListener("playing", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("ended", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("error", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("seeking", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("seeked", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("pause", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("ratechange", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("stalled", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("volumechange", _.bind(raiseGeneralEvent, this, callback));
      this._video.addEventListener("timeupdate", _.bind(raiseTimeUpdate, this, callback));
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
      // video_dom_wrapper has better implementation on safeSeekRange
      // bug to watch out for "Failed to set the 'currentTime' property on 'HTMLMediaElement': The provided double value is non-finite."
      this._video.currentTime = safeSeekTime(time);
    };

    this.setVolume = function(volume) {
      // video_dom_wrapper has better implementation on safe volume set
      this._video.volume = volume;
    };

    this.destroy = function() {
      this._video.pause();
      $(this._video).remove();
    };

    /************************************************************************************/
    // Event callback methods
    /************************************************************************************/

    var raiseGeneralEvent = function(callback, event) {
      callback(event.type, event);
    };

    var raiseTimeUpdate = function(callback, event) {
      // calls callback(eventname, [currentTime, duration]);
      callback(event.type, [event.srcElement.currentTime, event.srcElement.duration]);
    };

    /************************************************************************************/
    // Helper methods
    /************************************************************************************/
    var getRandomString = function() {
      return Math.random().toString(36).substring(7);
    };

    var safeSeekTime = _.bind(function(time) {
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
