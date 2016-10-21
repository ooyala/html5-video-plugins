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
  player= document.createElement('div');
  player.id ="player";
  player.style.position = "absolute";
  player.style.top = "0px";
  player.style.left = "0px";
  var youtubePlayer;
  var youtubeVideoContainer;
  var element;
  var youtubeID;
  var playerReady = false;
  var bitrateFlag = true;
  var javascriptCommandQueue = [];
  var qualities = [];

  /**
   * @class OoyalaYoutubeVideoFactory
   * @classdesc Factory for creating video player objects for youtube videos.
   * @property {string} name The name of the plugin
   * @property {object} encodings An array of supported encoding types (ex. OO.VIDEO.ENCODING.MP4)
   * @property {object} features An array of supported features (ex. OO.VIDEO.FEATURE.BITRATE_CONTROL)
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
   *This function creates an <iframe> (YouTube player)
   *after the API code downloads.
   * @property {object} youtubePlayer The youtube player is creted and assigned to youtubePlayer.
   */
  function onYouTubeIframeAPIReady() {
    youtubePlayer = new YT.Player('player', {
      videoId: youtubeID,
      height: "100%",
      width: "100%",
      playerVars: { 'autoplay': 0, 'controls': 0 },
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
   *The Youtube iframe API will call this function when the video player is ready.
   * @param {object} event The event from the youtube once the player is ready.
   */
  function onPlayerReady(event) {
    playerReady = true;
    for(var i = 0; i < javascriptCommandQueue.length; i++) 
    {
      if(javascriptCommandQueue[i][0] === "play")
      { 
        element.play();
        hasPlayed = true;
      }
      else if(javascriptCommandQueue[i][0] === "seek")
      {  
        element.seek(javascriptCommandQueue[i][1])
      }    
    }    
  };

  /*
   *The Youtube iframe API calls this function when the player's quality changes.
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
   *The Youtube iframe API calls this function when the player's state changes.
   * @param {object} event The event from the youtube on player state change.
   */
  function onPlayerStateChange(event) {
    if(event.data == null) return;
    switch(event.data) {
      case -1:
       // unstarted
        break;
      case 0:
        // ended
        element.controller.notify(element.controller.EVENTS.ENDED);
        break;
      case 1:
        // playing 
        OO.log("Youtube: Playing event received");
        element.controller.notify(element.controller.EVENTS.PLAYING);

        if (bitrateFlag) {
          qualities = youtubePlayer.getAvailableQualityLevels();
          element.raiseBitratesAvailable();
          bitrateFlag = false;
        }      
        break;
      case 2:
        // paused 
        element.controller.notify(element.controller.EVENTS.PAUSED);
        break;
      case 3:
        // buffering
        OO.log("Youtube: Buffering event received"); 
        break;
      case 5:
        // video cued 
        break;
    }
  };

  /*
   *The Youtube iframe API calls this function when the player's throws an error.
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
      if(playerReady)
      {
        youtubePlayer.playVideo();
        this.controller.notify(this.controller.EVENTS.PLAY, { url: youtubeID });
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
      if(playerReady)
      {
        youtubePlayer.seekTo(time,true);
        this.controller.notify( this.controller.EVENTS.SEEKED);
      }
      else
      {
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
      if(youtubeId)
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
      player = null;
    };

    /**
     * To trigger the playhead update every 255 milliseconds.
     * @private
     * @method OoyalaYoutubeVideoWrapper#updateTimerDisplay
     */
    var updateTimerDisplay = function()
    {
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
