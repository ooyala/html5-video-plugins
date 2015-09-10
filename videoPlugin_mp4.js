/*
 * Simple HTML5 video tag plugin for mp4
 * version: 0.1
 */

OO.Video.plugin((function(_, $) {
  /**
   * @class OoyalaVideoPlugin
   * @classdesc
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use.  True if elements can be created.
   */
  OoyalaVideoPlugin = function() {
    this.name = "ooyalaVideoPlugin";
    this.ready = false;
    this.videoWrappers = {};

    var video = document.createElement("video");
    this.streams = (!!video.canPlayType("application/vnd.apple.mpegurl") || !!video.canPlayType("application/x-mpegURL")) ? ["m3u8", "mp4"] : ["mp4"];

    /************************************************************************************/
    // Required. Methods that Video Controller calls
    /************************************************************************************/
    this.create = function(parentContainer, stream, id) {
      if (this.videoWrappers[id]) this.videoWrappers[id];

      var video = $("<video>");
      video.attr("class", "video");
      video.attr("preload", "none");
      video.attr("crossorigin", "anonymous");
      if (this.isIos()) {
        video.attr("x-webkit-airplay", "allow");
      }

      this.videoWrappers[id] = new VideoWrapper(video[0]);
      this.videoWrappers[id].setVideoUrl(stream);

      parentContainer.append(video);
      return this.videoWrappers[id];
    };

    this.play = function(id) {
      this.videoWrappers[id].play();
    };

    this.pause = function(id) {
      this.videoWrappers[id].pause();
    };

    this.seek = function(id, time) {
      this.videoWrappers[id].seek(time);
    };

    this.setVolume = function(id, volume) {
      this.videoWrappers[id].setVolume(volume);
    };

    /************************************************************************************/
    // Plugin methods. To Notify Video Controller that something happens
    /************************************************************************************/
    this.notify = function() {
      // Need to notify Video controller that videoWrappers[id] is playing or paused
    };

    /************************************************************************************/
    // Helper methods
    /************************************************************************************/

    this.isIos = function() {
      var platform = window.navigator.platform;
      return platform.match(/iPhone/) || platform.match(/iPad/) || platform.match(/iPod/);
    };
  };

  VideoWrapper = function(video) {
    this._video = video;
    this._currentUrl = '';
    this.isM3u8 = false;
    this._readyToPlay = false;

    // Allow for the video src to be changed without loading the video
    // @param url: the new url to insert into the video element's src attribute
    this.setVideoUrl = function(url) {
      // check if we actually need to change the URL on video tag
      // compare URLs but make sure to strip out the trailing cache buster
      var urlChanged = false;
      if (this._currentUrl.replace(/[\?\&]_=[^&]+$/,'') != url) {
        this._currentUrl = url || "";

        // bust the chrome stupid caching bug
        if(this._currentUrl.length > 0 && this.isChrome()) {
          this._currentUrl = this._currentUrl + (/\?/.test(this._currentUrl) ? "&" : "?") + "_=" + this.getRandomString();
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
      this._video.currentTime = time;
    };

    this.setVolume = function(volume) {
      // video_dom_wrapper has better implementation on safe volume set
      this._video.volume = volume;
    };

    this.isChrome = function() {
      return !!window.navigator.userAgent.match(/Chrome/);
    };

    this.getRandomString = function() {
      return Math.random().toString(36).substring(7);
    };
  };

  return new OoyalaVideoPlugin();
}(OO._, OO.$)));
