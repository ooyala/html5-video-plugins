/*
 * Video plugin template
 * This template can serve as an example of a Video Technology Plugin
 * version: 0.1
 */

require('../html5-common/js/utils/InitModules/InitOO.js');
require('../html5-common/js/utils/InitModules/InitOOUnderscore.js');
require('../html5-common/js/utils/constants.js');

(function(_, $) {
  /**
   * @class TemplateVideoFactory
   * @classdesc Factory for creating video player objects that use HTML5 video tags.
   * @property {string} name The name of the plugin
   * @property {object} encodings An array of supported encoding types (ex. OO.VIDEO.ENCODING.MP4)
   * @property {object} features An array of supported features (ex. OO.VIDEO.FEATURE.CLOSED_CAPTIONS)
   * @property {string} technology The core video technology (ex. OO.VIDEO.TECHNOLOGY.HTML5)
   */
  let TemplateVideoFactory = function() {
    this.name = 'templateVideoTech';
    this.encodings = [OO.VIDEO.ENCODING.HLS, OO.VIDEO.ENCODING.MP4];
    this.features = [ OO.VIDEO.FEATURE.CLOSED_CAPTIONS,
      OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE ];
    this.technology = OO.VIDEO.TECHNOLOGY.HTML5;

    /**
     * Creates a video player instance using TemplateVideoWrapper.
     * @public
     * @method TemplateVideoFactory#create
     * @param {object} parentContainer The jquery div that should act as the parent for the video element
     * @param {string} domId The dom id of the video player instance to create
     * @param {object} ooyalaVideoController A reference to the video controller in the Ooyala player
     * @param {object} css The css to apply to the video element
     * @param {string} playerId The unique player identifier of the player creating this instance
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = function(parentContainer, domId, ooyalaVideoController, css, playerId) {
      let element = {};
      let wrapper = new TemplateVideoWrapper(domId, element);
      wrapper.controller = ooyalaVideoController;
      wrapper.subscribeAllEvents();
      return wrapper;
    };

    /**
    * Creates a video player instance using TemplateVideoWrapper which wraps and existing video element.
    * This function is only needed if the feature OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_TAKE is supported.
    * @public
    * @method TemplateVideoFactory#createFromExisting
    * @param {string} domId The dom id of the video DOM object to use
    * @param {object} ooyalaVideoController A reference to the video controller in the Ooyala player
    * @param {string} playerId The unique player identifier of the player creating this instance
    * @returns {object} A reference to the wrapper for the video element
    */
    this.createFromExisting = function(domId, ooyalaVideoController, playerId) {
      let sharedVideoElement = $('#' + domId)[0];
      let wrapper = new TemplateVideoWrapper(domId, sharedVideoElement);
      wrapper.controller = ooyalaVideoController;
      wrapper.subscribeAllEvents();
      return wrapper;
    };

    /**
     * Destroys the video technology factory.
     * @public
     * @method TemplateVideoFactory#destroy
     */
    this.destroy = function() {
      this.encodings = [];
      this.create = function() {};
    };

    /**
     * Represents the max number of support instances of video elements that can be supported on the
     * current platform. -1 implies no limit.
     * @public
     * @property TemplateVideoFactory#maxSupportedElements
     */
    this.maxSupportedElements = -1;
  };

  /**
   * @class TemplateVideoWrapper
   * @classdesc Player object that wraps the video element.
   * @param {string} domId The dom id of the video player element
   * @param {object} video The core video object to wrap
   * @property {object} controller A reference to the Ooyala Video Tech Controller
   * @property {boolean} disableNativeSeek When true, the plugin should supress or undo seeks that come from
   *                                       native video controls
   */
  const TemplateVideoWrapper = function(domId, video) {
    let _video = video;
    let listeners = {};

    this.controller = {};
    this.disableNativeSeek = false;

    /************************************************************************************/
    // Required. Methods that Video Controller, Destroy, or Factory call
    /************************************************************************************/

    /**
     * Hands control of the video element off to another plugin.
     * This function is only needed if the feature OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE or
     * OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_TAKE is supported.
     * @public
     * @method TemplateVideoWrapper#sharedElementGive
     */
    this.sharedElementGive = function() {
      // after losing control, the wrapper should not raise notify events
      unsubscribeAllEvents();
    };

    /**
     * Takes control of the video element from another plugin.
     * This function is only needed if the feature OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE or
     * OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_TAKE is supported.
     * @public
     * @method TemplateVideoWrapper#sharedElementTake
     */
    this.sharedElementTake = function() {
      // after taking control, the wrapper should raise notify events
      this.subscribeAllEvents();
    };

    /**
     * Subscribes to all events raised by the video element.
     * This is called by the Factory during creation.
     * @public
     * @method TemplateVideoWrapper#subscribeAllEvents
     */
    this.subscribeAllEvents = function() {
      listeners = { 'play': _.bind(raisePlayEvent, this),
        'playing': _.bind(raisePlayingEvent, this),
        'ended': _.bind(raiseEndedEvent, this),
        'error': _.bind(raiseErrorEvent, this),
        'seeking': _.bind(raiseSeekingEvent, this),
        'seeked': _.bind(raiseSeekedEvent, this),
        'pause': _.bind(raisePauseEvent, this),
        'ratechange': _.bind(raiseRatechangeEvent, this),
        'stalled': _.bind(raiseStalledEvent, this),
        'volumechange': _.bind(raiseVolumeEvent, this),
        'volumechangeNew': _.bind(raiseVolumeEvent, this),
        'waiting': _.bind(raiseWaitingEvent, this),
        'timeupdate': _.bind(raiseTimeUpdate, this),
        'durationchange': _.bind(raiseDurationChange, this),
        'progress': _.bind(raiseProgress, this),
        'canplaythrough': _.bind(raiseCanPlayThrough, this),
        'webkitbeginfullscreen': _.bind(raiseFullScreenBegin, this),
        'webkitendfullscreen': _.bind(raiseFullScreenEnd, this),
      };
      _.each(listeners, function(listener, index) { $(_video).on(index, listener); }, this);
    };

    /**
     * Unsubscribes all events from the video element.
     * This function is not required but can be called by the destroy function.
     * @private
     * @method TemplateVideoWrapper#unsubscribeAllEvents
     */
    const unsubscribeAllEvents = _.bind(function() {
      _.each(listeners, function(listener, index) { $(_video).off(index, listener); }, this);
    }, this);

    /**
     * Set DRM data
     * @public
     * @method TemplateVideoWrapper#setDRM
     * @param {object} drm DRM data object contains widevine, playready and fairplay as keys and object as value that includes
     * la_url {string} (optional for playready), and certificate_url {string} (for fairplay only).
     * (ex. {"widevine": {"la_url":"https://..."},"playready": {}, "fairplay": {"la_url":"https://...", "certificate_url":"https://..."}}})
     */
    this.setDRM = function(drm) {
    };

    /**
     * Sets the url of the video.
     * @public
     * @method TemplateVideoWrapper#setVideoUrl
     * @param {string} url The new url to insert into the video element's src attribute
     * @param {string} encoding The encoding of video stream, possible values are found in OO.VIDEO.ENCODING
     * @param {boolean} isLive True if it is a live asset, false otherwise
     * @param {number} initialTime The initial time to set, in seconds
     * @returns {boolean} True or false indicating success
     */
    this.setVideoUrl = function(url, encoding, isLive, initialTime) {
      return true;
    };

    /**
     * Callback to handle notifications that ad finished playing
     * @private
     * @method TemplateVideoWrapper#onAdsPlayed
     */
    this.onAdsPlayed = function() {
    };

    /**
     * Loads the current stream url in the video element; the element should be left paused.  This function
     * is generally called when preloading a stream before triggering play.  Load may not be called before
     * play.
     * @public
     * @method TemplateVideoWrapper#load
     * @param {boolean} rewind True if the stream should be setup to play as if from the beginning.  When
     *   true, if initial time has not been set, or if the stream has already been played, set the stream
     *   position to 0.
     */
    this.load = function(rewind) {
    };

    /**
     * Sets the initial time of the video playback.  This value should not be used on replay.
     * @public
     * @method TemplateVideoWrapper#setInitialTime
     * @param {number} initialTime The initial time of the video (seconds)
     */
    this.setInitialTime = function(initialTime) {
    };

    /**
     * Triggers playback on the video element.  If the 'load' function was not already called and the stream
     * is not loaded, trigger a load now.
     * @public
     * @method TemplateVideoWrapper#play
     */
    this.play = function() {
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method TemplateVideoWrapper#pause
     */
    this.pause = function() {
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method TemplateVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     */
    this.seek = function(time) {
    };

    /**
     * !!DEPRECATED!! - this check is now done automatically
     * Checks to see if autoplay requires the video to be muted
     * @public
     * @method TemplateVideoWrapper#requiresMutedAutoplay
     * @param {boolean} true if video must be muted to autoplay, false otherwise
     */
    this.requiresMutedAutoplay = function() {
    };

    /**
     * Notifies a video plugin that an unmuted content auto-playback succeeded. When a video plugin
     * receives this, it should setup for unmuted auto-playback.
     * @public
     * @method TemplateVideoWrapper#notifyUnmutedContentAutoPlaybackSucceeded
     */
    this.notifyUnmutedContentAutoPlaybackSucceeded = function() {
    };

    /**
     * Triggers a mute on the video element.
     * @public
     * @method TemplateVideoWrapper#mute
     */
    this.mute = function() {
    };

    /**
     * Triggers an unmute on the video element.
     * @public
     * @method TemplateVideoWrapper#unmute
     */
    this.unmute = function() {
    };

    /**
     * Checks to see if the video element is muted.
     * @public
     * @method TemplateVideoWrapper#isMuted
     * @returns {boolean} True if the video element is muted, false otherwise
     */
    this.isMuted = function() {
      return true;
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method TemplateVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     * @param {boolean} muteState True if the video is desired to be muted, false otherwise. This
     *                            is useful for videos or SDKs that do not separate mute states and volumes
     */
    this.setVolume = function(volume, muteState) {
    };

    /**
     * Gets the current time position of the video.
     * @public
     * @method TemplateVideoWrapper#getCurrentTime
     * @returns {number} The current time position of the video (seconds)
     */
    this.getCurrentTime = function() {
      return 0;
    };

    /**
     * Prepares a video element to be played via API.  This is called on a user click event, and is used in
     * preparing HTML5-based video elements on devices.  To prepare the element for playback, call play and
     * pause.  Do not raise playback events during this time.
     * @public
     * @method TemplateVideoWrapper#primeVideoElement
     */
    this.primeVideoElement = function() {
    };

    /**
     * Applies the given css to the video element.
     * @public
     * @method TemplateVideoWrapper#applyCss
     * @param {object} css The css to apply in key value pairs
     */
    this.applyCss = function(css) {
    };

    /**
     * Destroys the individual video element.
     * @public
     * @method TemplateVideoWrapper#destroy
     */
    this.destroy = function() {
      // Pause the video
      // Reset the source
      // Unsubscribe all events
      unsubscribeAllEvents();
      // Remove the element
    };

    /**
     * Sets the closed captions on the video element.
     * @public
     * @method TemplateVideoWrapper#setClosedCaptions
     * @param {string} language The language of the closed captions. Set to null to remove captions.
     * @param {object} closedCaptions The closedCaptions object
     * @param {object} params The params to set with closed captions
     */
    this.setClosedCaptions = function(language, closedCaptions, params) {
    };

    /**
     * Sets the closed captions mode on the video element.
     * @public
     * @method TemplateVideoWrapper#setClosedCaptionsMode
     * @param {string} mode The mode to set the text tracks element. One of ("disabled", "hidden", "showing").
     */
    this.setClosedCaptionsMode = function(mode) {
    };

    /**
     * Sets the crossorigin attribute on the video element.
     * @public
     * @method TemplateVideoWrapper#setCrossorigin
     * @param {string} crossorigin The value to set the crossorigin attribute.
     */
    this.setCrossorigin = function(crossorigin) {
    };

    /**
     * Gets the list of all available audio tracks
     * @public
     * @method TemplateVideoWrapper#getAvailableAudio
     * @returns {Array} - an array of all available audio tracks
     */
    this.getAvailableAudio = function() {
      return [];
    };

    /**
     * ets the audio track to the ID specified by trackID
     * @public
     * @method TemplateVideoWrapper#setAudio
     * @param {String} trackID - the ID of the audio track to activate
     * @returns {Array} - an array of all available audio tracks
     */
    this.setAudio = function(trackID) {
      return [];
    };

    /**
     * Sets the stream to play back based on given stream ID. Plugin must support the
     * BITRATE_CONTROL feature to have this method called.
     * @public
     * @method TemplateVideoWrapper#setBitrate
     * @param {string} id The ID of the stream to switch to. This ID will be the ID property from one
     *   of the stream objects passed with the BITRATES_AVAILABLE VTC event.
     *   An ID of 'auto' should return the plugin to automatic bitrate selection.
     */
    this.setBitrate = function(id) {
    };

    /**
     * Optional function. Set the playback speed of the video element
     * @public
     * @method TemplateVideoWrapper#setPlaybackSpeed
     * @param  {number} speed The desired speed multiplier
     */
    this.setPlaybackSpeed = function(speed) {
    };

    /**
     * Get the playback speed of the current video element.
     * @public
     * @method TemplateVideoWrapper#getPlaybackSpeed
     * @returns {number} The speed multiplier
     */
    this.getPlaybackSpeed = function() {
      return 1;
    };

    // **********************************************************************************/
    // Example callback methods
    // **********************************************************************************/

    const raisePlayEvent = function(event) {
      this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
    };

    const raisePlayingEvent = function() {
      this.controller.notify(this.controller.EVENTS.PLAYING);
    };

    const raiseEndedEvent = function() {
      this.controller.notify(this.controller.EVENTS.ENDED);
    };

    const raiseErrorEvent = function(event) {
      let code = event.target.error ? event.target.error.code : -1;
      this.controller.notify(this.controller.EVENTS.ERROR, { 'errorcode': code });
    };

    const raiseSeekingEvent = function() {
      this.controller.notify(this.controller.EVENTS.SEEKING);
    };

    const raiseSeekedEvent = function() {
      this.controller.notify(this.controller.EVENTS.SEEKED);
    };

    const raisePauseEvent = function() {
      this.controller.notify(this.controller.EVENTS.PAUSED);
    };

    const raiseRatechangeEvent = function() {
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    };

    const raiseStalledEvent = function() {
      this.controller.notify(this.controller.EVENTS.STALLED);
    };

    const raiseVolumeEvent = function(event) {
      this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { 'volume': event.target.volume });
    };

    const raiseWaitingEvent = function() {
      this.controller.notify(this.controller.EVENTS.WAITING);
    };

    const raiseTimeUpdate = function(event) {
      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event);
    };

    const raiseDurationChange = function(event) {
      raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
    };

    const raisePlayhead = _.bind(function(eventname, event) {
      this.controller.notify(eventname,
        { 'currentTime': event.target.currentTime,
          'duration': event.target.duration,
          'buffer': 10,
          'seekRange': { 'begin': 0, 'end': 10 } });
    }, this);

    const raiseProgress = function(event) {
      this.controller.notify(this.controller.EVENTS.PROGRESS,
        { 'currentTime': event.target.currentTime,
          'duration': event.target.duration,
          'buffer': 10,
          'seekRange': { 'begin': 0, 'end': 10 } });
    };

    const raiseCanPlayThrough = function() {
      this.controller.notify(this.controller.EVENTS.BUFFERED);
    };

    const raiseFullScreenBegin = function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
        { 'isFullScreen': true, 'paused': event.target.paused });
    };

    const raiseFullScreenEnd = function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
        { 'isFullScreen': false, 'paused': event.target.paused });
    };
    /* eslint-disable no-unused-vars */
    // The VTC should be notified whenever a plugin changes streams to a different bitrate or resolution.
    // Bitrate should be reported in bits per second.
    let raiseBitrateChanged = function(event) {
      this.controller.notify(this.controller.EVENTS.BITRATE_CHANGED,
        { 'id': 'medium', 'height': 1080, 'width': 1920, 'bitrate': 7500000 });
    };

    // Plugin must support the BITRATE_CONTROL feature notify the controller of this event.
    // Bitrate should be reported in bits per second.
    let raiseBitratesAvailable = function(event) {
      this.controller.notify(this.controller.EVENTS.BITRATES_AVAILABLE,
        [{ 'id': 'low', 'height': 1080, 'width': 1920, 'bitrate': 3750000 },
          { 'id': 'medium', 'height': 1080, 'width': 1920, 'bitrate': 7500000 },
          { 'id': 'high', 'height': 1080, 'width': 1920, 'bitrate': 15000000 }]);
    };

    // The VTC should be notified with new cue text whenever a plugin closed caption cue changes.
    let raiseClosedCaptionCueChanged = function(cueText) {
      this.controller.notify(this.controller.EVENTS.CLOSED_CAPTION_CUE_CHANGED, cueText);
    };
  };

  OO.Video.plugin(new TemplateVideoFactory());
}(OO._, OO.$));
