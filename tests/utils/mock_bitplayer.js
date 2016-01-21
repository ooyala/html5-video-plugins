mock_bitplayer = function() {
  this.duration = 0;
  this.currentTime = 0;
  this.volume = 0;
  this.isPaused = false;
  this.exists = true;
  this.trackId = "";
  this.cc_url = "";
  this.cc_language = "";
  this.cc_name = "";
  this.cc_subtitle = "";
  this.subtitles = {};
  
  this.isReady = function() {
    return true;
  };
  
  this.load = function(reload) {
  };
  
  this.pause = function() {
    this.paused = true;
  };
  
  this.isPaused = function() {
    return this.paused;
  };

  this.seek = function(time) {
    this.currentTime = time;
  };
  
  this.play = function() {
    this.paused = false;
  };

  this.getDuration = function() {
    return this.duration;
  };

  this.getVideoBufferLength = function() {
    return 100;
  }

  this.getCurrentTime = function() {
    return this.currentTime;
  };
  
  this.getVolume = function() {
    return this.volume;
  };
  
  this.setVolume = function(volume) {
    this.volume = volume;
  };

  this.addSubtitle = function(url, trackId, subtitle, language, name) {
    var obj = {
      url: url,
      label: name,
      lang: language
    }
    var arr = this.subtitles.trackId || [];
    arr.push(obj);
    this.subtitles.trackId = arr;

    this.cc_url = url;
    this.cc_language = language;
    this.cc_name = name;
    this.cc_subtitle = subtitle;
  };

  this.removeSubtitle = function(trackId) {
    delete subtitles.trackId;
    this.trackId = null;
  }

  this.setSubtitle = function(trackId) {
    this.trackId = trackId;
  };

  this.getSubtitle = function() {
    if (!!this.trackId) { // XXX fix this!
      return this.subtitles.trackId;
    } else {
      return null;
    }
  };

  this.getAvailableSubtitles = function() {
    return this.subtitles;
  };

  this.destroy = function() { 
    this.exists = false; // to verify that destroy was called
  };
};
