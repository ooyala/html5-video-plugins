mock_vtc = function() {
  // Test properties that indicate which events were raised by the video wrapper
  this.notifyParameters = null;
  this.notified = [];
  this.notifyParametersHistory = [];

  // The vtc interface to pass to the video wrapper
  this.interface = {
    PLUGIN_MAGIC: 'key',
    EVENTS: {
      ASSET_DIMENSION: "assetDimension",
      BUFFERING: "buffering",
      BUFFERED: "buffered",
      BITRATES_AVAILABLE:  "bitratesAvailable",
      BITRATE_CHANGED:  "bitrateChanged",
      CAPTIONS_FOUND_ON_PLAYING:  "captionsFoundOnPlaying",
      CLOSED_CAPTION_CUE_CHANGED:  "closedCaptionCueChanged",
      ERROR:  "error",
      FULLSCREEN_CHANGED:  "fullScreenChanged",
      METADATA_FOUND:  "metadataFound",
      PAUSED:  "paused",
      PLAY:  "play",
      PLAYING:  "playing",
      SEEKED:  "seeked",
      SEEKING:  "seeking",
      TIME_UPDATE:  "timeupdate",
      VOLUME_CHANGE:  "volumechange",
      MUTE_STATE_CHANGE:  "mutestatechange",
      PLAYBACK_RATE_CHANGE:  "playbackRateChange",
      ON_DOWNLOAD_FINISHED:  "onDownloadFinished",
      ON_SEGMENT_LOADED:  "onSegmentLoaded",
      WAITING:  "waiting",
      DURATION_CHANGE: "durationChange",
      UNMUTED_PLAYBACK_FAILED: "unmutedPlaybackFailed",
      UNMUTED_PLAYBACK_SUCCEEDED: "unmutedPlaybackSucceeded",
      MUTED_PLAYBACK_FAILED: "mutedPlaybackFailed",
      MUTED_PLAYBACK_SUCCEEDED: "mutedPlaybackSucceeded",
      MUTED_PLAYBACK_FAILED: "unmutedPlaybackFailed",
      MULTI_AUDIO_AVAILABLE: "multiAudioAvailable",
      MULTI_AUDIO_CHANGED: "multiAudioChanged"
    },
    notify: function(){
      if (arguments.length > 0) {
        this.notifyParameters = Array.prototype.slice.call(arguments);
        this.notifyParametersHistory.push(Array.prototype.slice.call(arguments));
        this.notified.push(arguments[0]);
      }
    }.bind(this),
    markNotReady: function() {},
    markReady: function() {}
  };

  this.getTrackById = function(id) {
    var currentElement = null;
    if (typeof id !== "undefined") {
      var array = this;
      if (Array.isArray(array)) {
        for (var index=0; index<array.length; index++) {
          if (array[index] && array[index].id === id) {
            currentElement = array[index];
            break;
          }
        }
      }
    }
    return currentElement;
  };

  // To clear the list of events notified to the mock vtc, call with this function
  this.reset = function() {
    this.notifyParameters = null;
    this.notified = [];
    this.notifyParametersHistory = [];
  }
};
