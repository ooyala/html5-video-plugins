/*
 * Simple HTML5 video tag plugin for mp4
 * version: 0.1
 */

OO.Video.plugin((function(_, $) {
  var pluginName = "ooyalaVideoPlugin";

  /**
   * @class OoyalaVideoPlugin
   * @classdesc
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use.  True if elements can be created.
   */
  OoyalaVideoPlugin = function() {
    this.name = pluginName;
    this.ready = false;

    var video = document.createElement("video");
    this.streams = (!!video.canPlayType("application/vnd.apple.mpegurl") || !!video.canPlayType("application/x-mpegURL")) ? ["m3u8", "mp4"] : ["mp4"];

    /************************************************************************************/
    // Required. Methods that Video Controller calls
    /************************************************************************************/
    this.create = function(parentContainer, stream, id) {
      var video = $("<video>");
      video.attr("class", "video");
      video.attr("preload", "none");
      video.attr("crossorigin", "anonymous");
      if (this.isIos()) {
        video.attr("x-webkit-airplay", "allow");
      }
      video.attr("style", "width:100%;height:100%");

      element = new VideoWrapper(id, video[0]);
      element.setVideoUrl(stream);
      element.streams = this.streams;

      parentContainer.append(video);
      return element;
    };

    /************************************************************************************/
    // Helper methods
    /************************************************************************************/

    this.isIos = function() {
      var platform = window.navigator.platform;
      return platform.match(/iPhone/) || platform.match(/iPad/) || platform.match(/iPod/);
    };
  };

  VideoWrapper = function(id, video) {
    this._id = id;
    this._video = video;
    this._currentUrl = '';
    this.isM3u8 = false;
    this._readyToPlay = false;

    // Callback takes: videoId, pluginName, event, params
    this.subscribe = function(callback) {
      var raiseEvent = function(callback, event) {
        callback(event.type, event);
      }

      // events minimum set
      this._video.addEventListener("playing", _.bind(raiseEvent, this, callback));
      this._video.addEventListener("ended", _.bind(raiseEvent, this, callback));
      this._video.addEventListener("error", _.bind(raiseEvent, this, callback));
      this._video.addEventListener("seeking", _.bind(raiseEvent, this, callback));
      this._video.addEventListener("seeked", _.bind(raiseEvent, this, callback));
      this._video.addEventListener("pause", _.bind(raiseEvent, this, callback));
      this._video.addEventListener("ratechange", _.bind(raiseEvent, this, callback));
      this._video.addEventListener("stalled", _.bind(raiseEvent, this, callback));
      this._video.addEventListener("volumechange", _.bind(raiseEvent, this, callback));

      // calls callback(eventname, [currentTime, duration]);
      var raiseTimeUpdate = function(callback, event) {
        callback(event.type, [event.srcElement.currentTime, event.srcElement.duration]);
      }
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
        if(this._currentUrl.length > 0 && isChrome) {
          this._currentUrl = this._currentUrl + (/\?/.test(this._currentUrl) ? "&" : "?") + "_=" + getRandomString();
        }

        this.isM3u8 = (this._currentUrl.toLowerCase().indexOf("m3u8") > 0);
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
      //     if (OO.isIos && OO.iosMajorVersion == 8) {
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

    // Private Helpers

    var getRandomString = function() {
      return Math.random().toString(36).substring(7);
    };

    var safeSeekTime = _.bind(function(time) {
      var safeTime = time >= this._video.duration ? this._video.duration - 0.01 : (time < 0 ? 0 : time);
      // iPad with 6.1 has an intersting bug that causes the video to break if seeking exactly to zero
      if (isIpad && safeTime < 0.1) { safeTime = 0.1; }
      return safeTime;
    }, this);

    // Platform
    var isIpad = (function() {
      return !!window.navigator.platform.match(/iPad/);
    })();

    var isChrome = (function() {
      return !!window.navigator.userAgent.match(/Chrome/);
    })();
  };

  return new OoyalaVideoPlugin();
}(OO._, OO.$)));
