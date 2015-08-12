OO.Video.plugin((function(_, $) {

  OoyalaVideoPlugin = function() {
    this.name = "ooyalaVideoPlugin";
    this.ready = false;
    this.videoWrapper = null;

    var video = document.createElement("video");
    this.streams = (!!video.canPlayType("application/vnd.apple.mpegurl") || !!video.canPlayType("application/x-mpegURL")) ? ["m3u8", "mp4"] : ["mp4"];
  };

  _.extend(OoyalaVideoPlugin.prototype, {
    /************************************************************************************/
    // Required. Methods that Video Controller calls
    /************************************************************************************/
    create: function(parentContainer, stream) {
      var video = $("<video>");
      video.attr("class", "video");
      video.attr("preload", "none");
      video.attr("crossorigin", "anonymous");
      if (this.isIos()) {
        video.attr("x-webkit-airplay", "allow");
      }

      this.videoWrapper = new VideoWrapper(video[0]);
      this.videoWrapper.setVideoUrl(stream);

      parentContainer.append(video);
    },

    play: function() {
      this.videoWrapper.play();
    },

    pause: function() {
      this.videoWrapper.pause();
    },

    seek: function(time) {
      this.videoWrapper.seek(time);
    },

    setVolume: function(volume) {
      this.videoWrapper.setVolume(volume);
    },

    /************************************************************************************/
    // Plugin methods. To Notify Video Controller that something happens
    /************************************************************************************/
    notify: function() {
      // Need to notify Video controller that videoWrapper is playing or paused
    },

    /************************************************************************************/
    // Helper methods
    /************************************************************************************/

    isIos: function() {
      var platform = window.navigator.platform;
      return platform.match(/iPhone/) || platform.match(/iPad/) || platform.match(/iPod/);
    },

  });

  VideoWrapper = function(video) {
    this._video = video;
    this._currentUrl = '';
    this.isM3u8 = false;
    this._readyToPlay = false;
  };

  _.extend(VideoWrapper.prototype, {
    // Allow for the video src to be changed without loading the video
    // @param url: the new url to insert into the video element's src attribute
    setVideoUrl: function(url) {
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
    },

    load: function(rewind) {
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
    },

    play: function() {
      this._video.play();
    },

    pause: function() {
      this._video.pause();
    },

    seek: function(time) {
      // video_dom_wrapper has better implementation on safeSeekRange
      this._video.currentTime = time;
    },

    setVolume: function(volume) {
      // video_dom_wrapper has better implementation on safe volume set
      this._video.volume = volume;
    },

    isChrome: function() {
      return !!window.navigator.userAgent.match(/Chrome/);
    },

    getRandomString: function() {
      return Math.random().toString(36).substring(7);
    },
  });

  return new OoyalaVideoPlugin();
}(OO._, OO.$)));