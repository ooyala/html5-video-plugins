/*
 * Youtube video plugin
 */

require("../../../html5-common/js/utils/InitModules/InitOO.js");
require("../../../html5-common/js/utils/InitModules/InitOOUnderscore.js");
require("../../../html5-common/js/utils/InitModules/InitOOHazmat.js");
require("../../../html5-common/js/utils/constants.js");
(function(_, $) {
 
  var pluginName = "ooyalaYoutubeVideoTech";
  var player;
  var youtubePlayer;
  var youtubeVideoContainer;
  var element;
  var youtubeID = '';
  var playerReady = false;
  var bitrateFlag = true;
  var javascriptCommandQueue = [];
  var qualities = [];

  /**
   * @class OoyalaYoutubeVideoFactory
   * @classdesc Factory for creating video player objects for youtube videos.
   * @property {string} name The name of the plugin
   * @property {string[]} encodings An array of supported encoding types (ex. OO.VIDEO.ENCODING.MP4)
   * @property {string[]} features An array of supported features (ex. OO.VIDEO.FEATURE.BITRATE_CONTROL)
   * @property {string} technology The core video technology (ex. OO.VIDEO.TECHNOLOGY.HTML5)
   */
  var OoyalaYoutubeVideoFactory = function() {
    this.name = pluginName;
    this.features = [ OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE,
                      OO.VIDEO.FEATURE.BITRATE_CONTROL ];
    this.technology = OO.VIDEO.TECHNOLOGY.HTML5;
    this.encodings = [OO.VIDEO.ENCODING.MP4];

    /**
     * Creates a video player instance using OoyalaYoutubeVideoWrapper.
     * @public
     * @method OoyalaYoutubeVideoFactory#create
     * @param {object} parentContainer The jquery div that should act as the parent for the video element
     * @param {string} domId The id of the video player instance to create
     * @param {object} controller A reference to the video controller in the Ooyala player
     * @param {object} css The css to apply to the video element
     * @param {string} playerId An id that represents the player instance
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = function(parentContainer, domId, controller, css, playerId) {
      player = '<div id="player"  style="position:absolute;top:0px;left:0px;"></div>';
      //Its best to create the div for iframe in the create. Has this method is called once the youtube plugin is choosen.
      if(player == null || parentContainer == null || controller == null)
      {
        console.warn("Youtube: Failed to create the player");
        return;
      }
      youtubeVideoContainer = parentContainer;
      $('head').append("<script type = 'text/javascript' src = 'http://www.youtube.com/iframe_api'></script>");
      window.onYouTubePlayerAPIReady = function() { onYouTubeIframeAPIReady(); }; 
      element = new OoyalaYoutubeVideoWrapper();
      if(element == null) return;
      element.controller = controller;
      controller.notify(controller.EVENTS.CAN_PLAY);

      youtubeVideoContainer.append(player);
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

    this.maxSupportedElements = -1;
  };

  /* 
   * Youtube iframe API will call this function to create an <iframe> (YouTube player)
   * once the API code downloads.
   * @public
   * @method onYouTubeIframeAPIReady
   * @property {object} youtubePlayer The youtube player is creted.
   */
  function onYouTubeIframeAPIReady() {
    //youtubeID is expected to be initialized
    if ( youtubeID === '' || youtubePlayer ) {
     OO.log("Youtube: youtubeID " + youtubeID + " not defined / youtubePlayer already exists");
     return;
    }
    youtubePlayer = new YT.Player('player', {
      videoId: youtubeID,
      height: "100%",
      width: "100%",
      playerVars: { 'autoplay': 0, 'controls': 0, 'rel': 0, 'showinfo': 0, 'modestbranding': 1 },
      events: {
      'onReady': onPlayerReady,
      'onPlaybackQualityChange': onPlayerPlaybackQualityChange,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
      }
    });
    if(!youtubePlayer)
    {
      element.controller.notify(element.controller.EVENTS.ERROR, { "errorcode" : -1 });
    }
  };

  /*
   * The Youtube iframe API will call this function when the video player is ready.
   * @public
   * @method onPlayerReady
   * @param {object} event The event from the youtube once the player is ready.
   */
  function onPlayerReady(event) {
    playerReady = true;
    if (javascriptCommandQueue.length < 1) return;
    for(var i = 0; i < javascriptCommandQueue.length; i++) 
    {
      switch(javascriptCommandQueue[i][0])
      {
        case OO.EVENTS.PLAY:
          element.play();
          hasPlayed = true;
          break;
        case OO.EVENTS.SEEK:
          if (javascriptCommandQueue[i].length > 1) element.seek(javascriptCommandQueue[i][1]);
          break;
        case OO.EVENTS.VOLUME_CHANGE:
          if (javascriptCommandQueue[i].length > 1) element.setVolume(javascriptCommandQueue[i][1]);
          break;
      }
    }    
  };

  /*
   * The Youtube iframe API calls this function when the player's quality changes.
   * @public
   * @method onPlayerPlaybackQualityChange
   * @param {object} event The event from the youtube on player quality change.
   */
  function onPlayerPlaybackQualityChange(event) {
    var vtcBitrate = {
      id: event.data,
      width: 0,
      height: 0,
      bitrate:event.data 
    }
    element.controller.notify(element.controller.EVENTS.BITRATE_CHANGED,vtcBitrate);
  };

  /*
   * The Youtube iframe API calls this function when the player's state changes.
   * @public
   * @method onPlayerStateChange
   * @param {object} event The event from the youtube on player state change.
   */
  function onPlayerStateChange(event) {
    if(event.data == null) return;
    switch(event.data) {
      case -1:
        OO.log("Youtube: Unstarted event received");
       // unstarted
        break;
      case 0:
        OO.log("Youtube: Ended event received");
        // ended
        element.controller.notify(element.controller.EVENTS.ENDED);
        break;
      case 1:
        // playing 
        OO.log("Youtube: Playing event received");
        if (bitrateFlag) {
          if(!youtubePlayer) return;
          qualities = youtubePlayer.getAvailableQualityLevels();
          element.raiseBitratesAvailable();
          bitrateFlag = false;
        }      
        break;
      case 2:
        OO.log("Youtube: Pause event received");
        // paused 
        element.controller.notify(element.controller.EVENTS.PAUSED);
        break;
      case 3:
        // buffering
        OO.log("Youtube: Buffering event received"); 
        break;
      case 5:
        OO.log("Youtube: Cued event received");
        // video cued 
        break;
    }
  };

  /*
   * The Youtube iframe API calls this function when the player's throws an error.
   * @public
   * @method onPlayerError
   * @param {object} event The event from the youtube on player error.
   */
  function onPlayerError(event) {
    if(event.data == null) return;
    var code = -1;
    switch(event.data) {
      case 2:
        OO.log("Youtube: invalid video id");
        element.controller.notify(element.controller.EVENTS.ERROR, { "errorcode" : code });
        // invalid video id
        break;
      case 5:
        OO.log("Youtube: The requested content cannot be played in an HTML5 player ");
        element.controller.notify(element.controller.EVENTS.ERROR, { "errorcode" : code });
        // The requested content cannot be played in an HTML5 player or another error related to the HTML5 player has occurred
        break;
      case 100:
        OO.log("Youtube: The video requested was not found.");
        element.controller.notify(element.controller.EVENTS.ERROR, { "errorcode" : code });
        // The video requested was not found. This error occurs when a video has been removed or has been marked as private 
        break;
      case 101:
        OO.log("Youtube: The owner of the requested video does not allow it to be played in embedded players.");
        element.controller.notify(element.controller.EVENTS.ERROR, { "errorcode" : code });
        // The owner of the requested video does not allow it to be played in embedded players. 
        break;
      case 150:
        OO.log("Youtube: invalid video id");
        element.controller.notify(element.controller.EVENTS.ERROR, { "errorcode" : code });
        // This error is the same as 101. It's just a 101 error in disguise! 
        break;
      }
  };

  /**
   * @class OoyalaYoutubeVideoWrapper
   * @classdesc Player object that wraps the video element.
   * @property {object} controller A reference to the Ooyala Video Tech Controller
   * @property {boolean} disableNativeSeek When true, the plugin should supress or undo seeks that come from
   *                                       native video controls
   */  
  var OoyalaYoutubeVideoWrapper = function() {
    this.controller = {};
    this.disableNativeSeek = false;
    var timeUpdateInterval = null;
    var hasPlayed = false;

    /**
     * Triggers playback on the video element.
     * @public
     * @method OoyalaYoutubeVideoWrapper#play
     */
    this.play = function() {
      if (!youtubePlayer) {
        javascriptCommandQueue.push(["play", null]);
        onYouTubeIframeAPIReady();  
        return;  
      }

      if (playerReady)
      {
        youtubePlayer.playVideo();
        this.controller.notify(this.controller.EVENTS.PLAY, { url: youtubeID });
        this.controller.notify(element.controller.EVENTS.PLAYING);
        updateTimerDisplay();
        hasPlayed = true;
      }
      else {
        javascriptCommandQueue.push(["play", null]);
      }
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method OoyalaYoutubeVideoWrapper#pause
     */
    this.pause = function(){
      if(!youtubePlayer) return;
      youtubePlayer.pauseVideo();
      clearInterval(timeUpdateInterval);
      timeUpdateInterval = null;
    };
    
    /**
     * Triggers a seek on the video element.
     * @public
     * @method OoyalaYoutubeVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     */
    this.seek = function(time) {
      if(!youtubePlayer) return;
      if(playerReady)
      {
        youtubePlayer.seekTo(time,true);
        this.controller.notify( this.controller.EVENTS.SEEKED);
      }
      else
      { 
        // control comes here only when the setinitial time calls the seek and the player is not yet in ready state.
        OO.log("Youtube: Adding setInitialTime to queue has the youtube player is not yet ready");
        javascriptCommandQueue.push(["seek", time]);
      }
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method OoyalaYoutubeVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = function(volume) {
      if(!youtubePlayer)
      {
        javascriptCommandQueue.push([OO.EVENTS.VOLUME_CHANGE, volume]);
        return;
      }
      youtubePlayer.setVolume(volume*100);
      this.controller.notify( this.controller.EVENTS.VOLUME_CHANGE, { "volume" :volume});
    };

    /**
     * Sets the initial time of the video playback.
     * @public
     * @method OoyalaYoutubeVideoWrapper#setInitialTime
     * @param {number} initialTime The initial time of the video (seconds)
     */
    this.setInitialTime = function(initialTime) {
      if (!hasPlayed) 
      {
        this.seek(initialTime);
      }
    };

    /**
     * Sets the url of the video.
     * @public
     * @method OoyalaYoutubeVideoWrapper#setVideoUrl
     * @param {string} youtubeId The youtube Id of the video that needs to be played. 
     * @param {string} encoding The encoding of video stream, possible values are found in OO.VIDEO.ENCODING
     * @returns {boolean} True or false indicating success
     */
    this.setVideoUrl = function(youtubeId, encoding, isLive) {   
      if (youtubeId)
      {
        youtubeID = youtubeId;                
        return true;
      }
      return false;
    };

    /**
     * Sets the stream to play back based on given stream ID. Plugin must support the
     * BITRATE_CONTROL feature to have this method called.
     * @public
     * @method OoyalaYoutubeVideoWrapper#setBitrate
     * @param {string} suggestedQuality The ID of the stream to switch to. This ID will be the ID property from one
     *   of the stream objects passed with the BITRATES_AVAILABLE VTC event.
     *   An ID of 'auto' should return the plugin to automatic bitrate selection.
     */
    this.setBitrate = function(suggestedQuality) {
      if(!youtubePlayer) return;
      youtubePlayer.setPlaybackQuality(suggestedQuality);
    };

    /**
     * Destroys the individual video element.
     * @public
     * @method OoyalaYoutubeVideoWrapper#destroy
     */
    this.destroy = function() {
      // Reset the source
      if (!OO.isEdge) 
      {
        this.setVideoUrl('');
      }
      else {
        youtubeID = '';
      }
      player = null;
      youtubePlayer.destroy();
      youtubePlayer = null;
      playerReady = false;
    };

    /**
     * To trigger the playhead update every 255 milliseconds.
     * @private
     * @method OoyalaYoutubeVideoWrapper#updateTimerDisplay
     */
    var updateTimerDisplay = function()
    {
      if(!youtubePlayer || !playerReady) return;
      clearInterval(timeUpdateInterval);
      timeUpdateInterval = setInterval(function () { updateTimerDisplay(); }, 255);
      raisePlayhead();
    }

    /**
     * Notifies the controller of events that provide playhead information.
     * @private
     * @method OoyalaYoutubeVideoWrapper#raisePlayhead
     */
    var raisePlayhead = _.bind(function() {
      if(!youtubePlayer) return;
      var timeUpdateObject = {
        "currentTime" : youtubePlayer.getCurrentTime(),
        "duration" : youtubePlayer.getDuration(),
        "seekRange" : { "begin" : 0, "end" : youtubePlayer.getDuration() }
      };
      this.controller.notify(this.controller.EVENTS.TIME_UPDATE, timeUpdateObject);
    }, this);

    /**
     * Notifies the controller about the available qualities
     * @public
     * @method OoyalaYoutubeVideoWrapper#raiseBitratesAvailable
     */
    this.raiseBitratesAvailable = function(){
      if(!qualities) return;
      var vtcBitrates = [{id: "auto", width: 0, height: 0, bitrate: "auto" }];
      for (var i = 0; i < qualities.length; i++) {
        if (qualities[i] != "auto") {
          var vtcBitrate = {
            id: qualities[i],
            width: 0,
            height: 0,
            bitrate: qualities[i]
          }
          vtcBitrates.push(vtcBitrate);
        }
      }
      this.controller.notify(this.controller.EVENTS.BITRATES_AVAILABLE,vtcBitrates);
    };
  };
  OO.Video.plugin(new OoyalaYoutubeVideoFactory());
}(OO._, OO.$));
