/*
 * Simple HTML5 video tag plugin for mp4 and hls
 * version: 0.1
 */

import TextTrackMap from './text_track/text_track_map';
import TextTrackHelper from './text_track/text_track_helper';
import CONSTANTS from './constants/constants';

require('../../../html5-common/js/utils/InitModules/InitOO.js');
require('../../../html5-common/js/utils/InitModules/InitOOUnderscore.js');
require('../../../html5-common/js/utils/InitModules/InitOOHazmat.js');
require('../../../html5-common/js/utils/constants.js');
require('../../../html5-common/js/utils/utils.js');
require('../../../html5-common/js/utils/environment.js');
(function(_, $) {
  let pluginName = 'ooyalaHtml5VideoTech';
  let currentInstances = {};

  /**
   * @class OoyalaVideoFactory
   * @classdesc Factory for creating video player objects that use HTML5 video tags
   * @property {string} name The name of the plugin
   * @property {object} encodings An array of supported encoding types (ex. OO.VIDEO.ENCODING.MP4)
   * @property {object} features An array of supported features (ex. OO.VIDEO.FEATURE.CLOSED_CAPTIONS)
   * @property {string} technology The core video technology (ex. OO.VIDEO.TECHNOLOGY.HTML5)
   */
  let OoyalaVideoFactory = function() {
    this.name = pluginName;

    this.features = [ OO.VIDEO.FEATURE.CLOSED_CAPTIONS,
      OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE ];
    this.technology = OO.VIDEO.TECHNOLOGY.HTML5;

    // Determine supported encodings
    let getSupportedEncodings = function() {
      let list = [];
      let videoElement = document.createElement('video');

      if (typeof videoElement.canPlayType === 'function') {
        if (videoElement.canPlayType('video/mp4')) {
          list.push(OO.VIDEO.ENCODING.MP4);
        }

        if (videoElement.canPlayType('audio/ogg')) {
          list.push(OO.VIDEO.ENCODING.AUDIO_OGG);
        }

        if (videoElement.canPlayType('audio/x-m4a')) {
          list.push(OO.VIDEO.ENCODING.AUDIO_M4A);
        }

        if (videoElement.canPlayType('video/webm')) {
          list.push(OO.VIDEO.ENCODING.WEBM);
        }

        if ((!!videoElement.canPlayType('application/vnd.apple.mpegurl') ||
             !!videoElement.canPlayType('application/x-mpegURL')) &&
            !OO.isSmartTV && !OO.isRimDevice &&
            (!OO.isMacOs || OO.isMacOsLionOrLater)) {
          // 2012 models of Samsung and LG smart TV's do not support HLS even if reported
          // Mac OS must be lion or later
          list.push(OO.VIDEO.ENCODING.HLS);
          list.push(OO.VIDEO.ENCODING.AKAMAI_HD2_VOD_HLS);
          list.push(OO.VIDEO.ENCODING.AKAMAI_HD2_HLS);
          // [PBW-7936] We don't support audio_hls on Android Chrome
          if (!OO.isChrome && !OO.isAndroid) {
            list.push(OO.VIDEO.ENCODING.AUDIO_HLS);
          }
        }

        // Sony OperaTV supports HLS but doesn't properly report it so we are forcing it here
        if (window.navigator.userAgent.match(/SonyCEBrowser/)) {
          list.push(OO.VIDEO.ENCODING.HLS);
          list.push(OO.VIDEO.ENCODING.AKAMAI_HD2_VOD_HLS);
          list.push(OO.VIDEO.ENCODING.AKAMAI_HD2_HLS);
          list.push(OO.VIDEO.ENCODING.AUDIO_HLS);
        }
      }
      return list;
    };
    this.encodings = getSupportedEncodings();

    /**
     * Creates a video player instance using OoyalaVideoWrapper
     * @public
     * @method OoyalaVideoFactory#create
     * @param {object} parentContainer The jquery div that should act as the parent for the video element
     * @param {string} domId The dom id of the video player instance to create
     * @param {object} controller A reference to the video controller in the Ooyala player
     * @param {object} css The css to apply to the video element
     * @param {string} playerId An id that represents the player instance
     * @param {object} pluginParams An object containing all of the options set for this plugin
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = function(
      parentContainer, domId, controller, css, playerId = getRandomString(), pluginParams) {
      // If the current player has reached max supported elements, do not create a new one
      if (this.maxSupportedElements > 0 && playerId &&
          currentInstances[playerId] >= this.maxSupportedElements) {
        return;
      }

      let video = $('<video>');
      video.attr('class', 'video');
      video.attr('id', domId);

      // [PBW-5470] On Safari, when preload is set to 'none' and the user switches to a
      // different tab while the video is about to auto play, the browser stops playback but
      // doesn't fire a 'pause' event, which causes the player to get stuck in 'buffering' state.
      // Setting preload to 'metadata' (or 'auto') allows Safari to auto resume when the tab is refocused.
      if (OO.isSafari && !OO.isIos) {
        video.attr('preload', 'metadata');
      } else {
        video.attr('preload', 'none');
      }

      video.css(css);

      if (OO.isIos) {
        // enable airplay for iOS
        // http://developer.apple.com/library/safari/#documentation/AudioVideo/Conceptual/AirPlayGuide/OptingInorOutofAirPlay/OptingInorOutofAirPlay.html
        //
        video.attr('x-webkit-airplay', 'allow');
      }
      // enable inline playback for mobile
      if (pluginParams && pluginParams['iosPlayMode'] === 'inline') {
        video.attr('playsinline', '');
      }

      let element = new OoyalaVideoWrapper(domId, video[0], playerId);
      if (currentInstances[playerId] && currentInstances[playerId] >= 0) {
        currentInstances[playerId]++;
      } else {
        currentInstances[playerId] = 1;
      }
      element.controller = controller;
      controller.notify(controller.EVENTS.CAN_PLAY);

      // TODO: Wait for loadstart before calling this?
      element.subscribeAllEvents();

      parentContainer.append(video);

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

    /**
     * Represents the max number of support instances of video elements that can be supported on the
     * current platform. -1 implies no limit.
     * @public
     * @property OoyalaVideoFactory#maxSupportedElements
     */
    this.maxSupportedElements = (function() {
      let iosRequireSingleElement = OO.isIos;
      const chromeVersion = 40;
      let androidRequireSingleElement = OO.isAndroid &&
                                        (!OO.isAndroid4Plus || OO.chromeMajorVersion < chromeVersion);
      return (iosRequireSingleElement || androidRequireSingleElement) ? 1 : -1;
    })();
  };

  /**
   * @class OoyalaVideoWrapper
   * @classdesc Player object that wraps HTML5 video tags
   * @param {string} domId The dom id of the video player element
   * @param {object} video The core video object to wrap
   * @param {string} playerId playerId
   * @property {object} controller A reference to the Ooyala Video Tech Controller
   * @property {boolean} disableNativeSeek When true, the plugin should supress or undo seeks that come from
   *                                       native video controls
   * @property {string} playerId An id representing the unique player instance
   */
  const OoyalaVideoWrapper = function(domId, video, playerId) {
    this.controller = {};
    this.disableNativeSeek = false;
    this.audioTracks = [];

    let _video = video;
    let _playerId = playerId;
    let _currentUrl = '';
    let videoEnded = false;
    let listeners = {};
    let loaded = false;
    let canPlay = false;
    let hasPlayed = false;
    let queuedSeekTime = null;
    let playQueued = false;
    let hasStartedPlaying = false;
    let pauseOnPlaying = false;
    let ignoreFirstPlayingEvent = false;
    let isSeeking = false;
    let isWrapperSeeking = false;
    let wasPausedBeforePlaying = false; // "playing" here refers to the "playing" event
    let handleFailover = false;
    let failoverPlayheadTime = 0;
    let currentTime = 0;
    let currentTimeShift = 0;
    let currentVolumeSet = 0;
    let isM3u8 = false;
    let firstPlay = true;
    // eslint-disable-next-line
    let videoDimension = { height: 0, width: 0 };
    let initialTime = { value: 0, reached: true };
    let canSeek = true;
    let isPriming = false;
    let isLive = false;
    let lastCueText = null;
    let originalPreloadValue = $(_video).attr('preload') || 'none';
    let currentPlaybackSpeed = 1.0;

    let currentCCKey = '';
    let setClosedCaptionsQueue = [];
    let externalCaptionsLanguages = {};
    const textTrackMap = new TextTrackMap();
    const textTrackHelper = new TextTrackHelper(_video);

    // Watch for underflow on Chrome
    let underflowWatcherTimer = null;
    let waitingEventRaised = false;
    let watcherTime = -1;

    // [PBW-4000] On Android, if the chrome browser loses focus, then the stream cannot be seeked before it
    // is played again.  Detect visibility changes and delay seeks when focus is lost.
    let watchHidden;
    if (OO.isAndroid && OO.isChrome) {
      const watchHidden = _.bind(function(evt) {
        if (document.hidden) {
          canSeek = false;
        }
      }, this);
      document.addEventListener('visibilitychange', watchHidden);
    }

    /************************************************************************************/
    // External Methods that Video Controller or Factory call
    /************************************************************************************/
    /**
     * Hands control of the video element off to another plugin by unsubscribing from all events.
     * @public
     * @method OoyalaVideoWrapper#sharedElementGive
     */
    this.sharedElementGive = function() {
      unsubscribeAllEvents();
      _currentUrl = '';
    };

    /**
     * Takes control of the video element from another plugin by subscribing to all events.
     * @public
     * @method OoyalaVideoWrapper#sharedElementTake
     */
    this.sharedElementTake = function() {
      this.subscribeAllEvents();
    };

    /**
     * Subscribes to all events raised by the video element.
     * This is called by the Factory during creation.
     * @public
     * @method OoyalaVideoWrapper#subscribeAllEvents
     */
    this.subscribeAllEvents = function() {
      listeners = { 'loadstart': onLoadStart,
        'loadedmetadata': onLoadedMetadata,
        'progress': raiseProgress,
        'error': raiseErrorEvent,
        'stalled': raiseStalledEvent,
        'canplay': raiseCanPlay,
        'canplaythrough': raiseCanPlayThrough,
        'playing': raisePlayingEvent,
        'waiting': raiseWaitingEvent,
        'seeking': raiseSeekingEvent,
        'seeked': raiseSeekedEvent,
        'ended': raiseEndedEvent,
        'durationchange': raiseDurationChange,
        'timeupdate': raiseTimeUpdate,
        'play': raisePlayEvent,
        'pause': raisePauseEvent,
        'ratechange': raiseRatechangeEvent,
        // ios webkit browser fullscreen events
        'webkitbeginfullscreen': raiseFullScreenBegin,
        'webkitendfullscreen': raiseFullScreenEnd,
      };
      // events not used:
      // suspend, abort, emptied, loadeddata, resize, change, addtrack, removetrack
      _.each(listeners, function(listener, index) { $(_video).on(index, listener); }, this);
      // The volumechange event does not seem to fire for mute state changes when using jQuery
      // to add the event listener. It does work using the below line. We need this event to fire properly
      // or else other SDKs (such as the Freewheel ad SDK) that make use of this video element may have
      // issues with the mute state
      _video.addEventListener('volumechange', raiseVolumeEvent);
    };

    /**
     * Unsubscribes all events from the video element.
     * This is called by the destroy function.
     * @private
     * @method OoyalaVideoWrapper#unsubscribeAllEvents
     */
    const unsubscribeAllEvents = function() {
      _.each(listeners, function(listener, index) { $(_video).off(index, listener); }, this);
      _video.removeEventListener('volumechange', raiseVolumeEvent);
    };

    /**
     * Sets the url of the video.
     * @public
     * @method OoyalaVideoWrapper#setVideoUrl
     * @param {string} url The new url to insert into the video element's src attribute
     * @param {string} encoding The encoding of video stream, possible values are found in OO.VIDEO.ENCODING
     * @param {boolean} live True if it is a live asset, false otherwise
     * @returns {boolean} True or false indicating success
     */
    // Allow for the video src to be changed without loading the video
    this.setVideoUrl = function(url, encoding, live) {
      // check if we actually need to change the URL on video tag
      // compare URLs but make sure to strip out the trailing cache buster
      let urlChanged = false;
      if (_currentUrl.replace(/[?&]_=[^&]+$/, '') !== url) {
        _currentUrl = url || '';

        isM3u8 = (encoding === OO.VIDEO.ENCODING.HLS ||
          encoding === OO.VIDEO.ENCODING.AKAMAI_HD2_VOD_HLS ||
          encoding === OO.VIDEO.ENCODING.AKAMAI_HD2_HLS ||
          encoding === OO.VIDEO.ENCODING.AUDIO_HLS
        );
        isLive = live;
        urlChanged = true;
        resetStreamData();
        if (_currentUrl === '') {
          // Workaround of an issue where iOS and MacOS attempt to set the src to <RELATIVE_PATH>/null
          // when setting source to null
          if (OO.isIos) {
            delete _video.src;
          } else if (OO.isMacOs && OO.isSafari) {
            _video.removeAttribute('src');
            // would not trigger Video#loadstart or Airplay#playbackTargetChanged events
            _video.load();
          } else {
            _video.src = null;
          }
        } else {
          _video.src = _currentUrl;
        }
      }
      // setup the playback speed for the next video.
      this.setPlaybackSpeed(currentPlaybackSpeed);
      return urlChanged;
    };

    const resetStreamData = _.bind(function() {
      this.audioTracks = [];
      playQueued = false;
      canPlay = false;
      hasPlayed = false;
      queuedSeekTime = null;
      loaded = false;
      hasStartedPlaying = false;
      pauseOnPlaying = false;
      isSeeking = false;
      isWrapperSeeking = false;
      firstPlay = true;
      wasPausedBeforePlaying = false;
      handleFailover = false;
      failoverPlayheadTime = 0;
      currentTime = 0;
      currentTimeShift = 0;
      videoEnded = false;
      videoDimension = { height: 0, width: 0 };
      initialTime = { value: 0, reached: true };
      canSeek = true;
      isPriming = false;
      stopUnderflowWatcher();
      lastCueText = null;
      currentCCKey = '';
      setClosedCaptionsQueue = [];
      externalCaptionsLanguages = {};
      textTrackHelper.removeExternalTracks(textTrackMap);
      textTrackMap.clear();
      // Restore the preload attribute to the value it had when the video
      // element was created
      $(_video).attr('preload', originalPreloadValue);
      ignoreFirstPlayingEvent = false;
    }, this);

    /**
     * Callback to handle notifications that ad finished playing
     * @private
     * @method OoyalaVideoWrapper#onAdsPlayed
     */
    this.onAdsPlayed = function() {
    };

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method OoyalaVideoWrapper#load
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = function(rewind) {
      if (loaded && !rewind) return;
      if (rewind) {
        if (OO.isEdge) {
          // PBW-4555: Edge browser will always go back to time 0 on load.  Setting time to 0 here would
          // cause the raw video element to enter seeking state.  Additionally, if we call load while seeking
          // on Edge, then seeking no longer works until the video stream url is changed.  Protect against
          // seeking issues using loaded.  Lastly edge always preloads.
          currentTime = 0;
        } else {
          try {
            const iosVersion = 8;
            if (OO.isIos && OO.iosMajorVersion === iosVersion) {
              // On iOS, wait for durationChange before setting currenttime
              $(_video).on('durationchange', _.bind(function() {
                _video.currentTime = 0;
                currentTime = 0;
              }, this));
            } else {
              _video.currentTime = 0;
              currentTime = 0;
            }
            _video.pause();
          } catch (ex) {
            // error because currentTime does not exist because stream hasn't been retrieved yet
            OO.log('VTC_OO: Failed to rewind video, probably ok; continuing');
          }
        }
      }
      canPlay = false;
      // The load() method might still be affected by the value of the preload attribute in
      // some browsers (i.e. it might determine how much data is actually loaded). We set preload to auto
      // before loading in case that this.load() was called by VC_PRELOAD. If load() is called prior to
      // starting playback this will be redundant, but it shouldn't cause any issues
      $(_video).attr('preload', 'auto');
      _video.load();
      loaded = true;
    };

    /**
     * Sets the initial time of the video playback.  For this plugin that is simply a seek which will be
     * triggered upon 'loadedmetadata' event.
     * @public
     * @method OoyalaVideoWrapper#setInitialTime
     * @param {number} time The initial time of the video (seconds)
     */
    this.setInitialTime = function(time) {
      // Ignore any initial times set to 0 if the content has not started playing. The content will start at time 0
      // by default
      if (typeof time !== 'number' || (!hasStartedPlaying && time === 0)) {
        return;
      }
      // [PBW-5539] On Safari (iOS and Desktop), when triggering replay after the current browser tab looses focus, the
      // current time seems to fall a few milliseconds behind the video duration, which
      // makes the video play for a fraction of a second and then stop again at the end.
      // In this case we allow setting the initial time back to 0 as a workaround for this
      let queuedSeekRequired = OO.isSafari && videoEnded && time === 0;
      initialTime.value = time;
      initialTime.reached = false;

      // [PBW-3866] Some Android devices (mostly Nexus) cannot be seeked too early or the seeked event is
      // never raised, even if the seekable property returns an endtime greater than the seek time.
      // To avoid this, save seeking information for use later.
      // [PBW-5539] Same issue with desktop Safari when setting initialTime after video ends
      // [PBW-7473] Same issue with IE11.
      if (OO.isAndroid || OO.isIE11Plus || (queuedSeekRequired && !OO.isIos)) {
        queueSeek(initialTime.value);
      } else {
        this.seek(initialTime.value);
      }
    };

    /**
     * Notifies wrapper that failover has occurred in the Ooyala Player
     * @public
     * @method OoyalaVideoWrapper#handleFailover
     * @param {number} failoverPlayhead The playhead time before failover (seconds)
     */
    this.handleFailover = function(failoverPlayhead) {
      handleFailover = true;
      failoverPlayheadTime = failoverPlayhead;
    };

    /**
     * Since there are no standards for error codes or names for play promises,
     * we'll compile a list of errors that represent a user interaction required error.
     * @private
     * @method OoyalaVideoWrapper#userInteractionRequired
     * @param {string} error The error object given by the play promise when it fails
     * @returns {boolean} True if this error represents a user interaction required error, false otherwise
     */
    let userInteractionRequired = function(error) {
      let userInteractionRequired = false;
      if (error) {
        let chromeError = error.name === 'NotAllowedError';
        // Safari throws the error "AbortError" for all play promise failures
        // so we'll have to treat all of them the same
        if (!OO.isChrome || chromeError) {
          // There is no requirement for muted autoplay on Firefox,
          // so we'll ignore any Firefox play promise errors
          userInteractionRequired = !OO.isFirefox;
        }
      }

      return userInteractionRequired;
    };

    /**
     * Triggers playback on the video element.
     * @public
     * @method OoyalaVideoWrapper#play
     */
    this.play = function() {
      pauseOnPlaying = false;
      // enqueue play command if in the process of seeking
      if (_video.seeking) {
        playQueued = true;
      } else {
        let playPromise = executePlay(false);
        let originalUrl = _video.src;
        if (playPromise) {
          ignoreFirstPlayingEvent = true;
          // TODO: Handle MUTED/UNMUTED_PLAYBACK_SUCCEEDED/FAILED in environments that do not support play promises.
          // Right now this is not needed because environments that do not support play promises do not have
          // autoplay restrictions.
          if (typeof playPromise.catch === 'function') {
            playPromise.catch(_.bind(function(error) {
              ignoreFirstPlayingEvent = false;
              if (error) {
                OO.log('Play Promise Failure', error, error.name);
                // PLAYER-3601: Workaround of an issue where play promises sometimes fail on iOS with Freewheel ads.
                // We can ignore these as the Freewheel ad plugin will take care of these if they are indeed errors
                if (OO.isIos && _video._fw_videoAdPlaying) {
                  return;
                }
                // Changing the source while attempting to play will cause a play promise error to be thrown.
                // We don't want to publish an UNMUTED/MUTED playback failed notification in these situations.
                if (_video.src !== originalUrl) {
                  OO.log('Url has changed, ignoring play promise failure');
                  return;
                }
                if (userInteractionRequired(error)) {
                  if (!_video.muted) {
                    this.controller.notify(this.controller.EVENTS.UNMUTED_PLAYBACK_FAILED, { error: error });
                  } else {
                    // [PBW-6990]
                    // There seems to be an issue on random Android devices that prevents muted
                    // autoplay from working at all under certain (currently unknown) conditions.
                    this.controller.notify(this.controller.EVENTS.MUTED_PLAYBACK_FAILED, { error: error });
                  }
                }
              }
            }, this));
          }
          if (typeof playPromise.then === 'function') {
            playPromise.then(_.bind(function() {
              if (handleFailover) {
                this.seek(failoverPlayheadTime);
                handleFailover = false;
              }
              // playback succeeded
              if (!_video.muted) {
                this.controller.notify(this.controller.EVENTS.UNMUTED_PLAYBACK_SUCCEEDED);
              } else {
                this.controller.notify(this.controller.EVENTS.MUTED_PLAYBACK_SUCCEEDED);
              }

              if (!pauseOnPlaying) {
                this.controller.notify(this.controller.EVENTS.PLAYING);
              }
            }, this));
          }
        }
      }
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method OoyalaVideoWrapper#pause
     */
    this.pause = function() {
      playQueued = false;
      if (hasStartedPlaying) {
        _video.pause();
      } else {
        pauseOnPlaying = true;
      }
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method OoyalaVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     * @returns {boolean} True if the seek was performed, false otherwise
     */
    this.seek = function(time) {
      if (time === Math.round(_video.currentTime)) {
        return false;
      }

      let safeSeekTime = null;

      if (isLive) {
        // Live videos without DVR can't be seeked
        if (!isDvrAvailable()) {
          // Re-queue the initial time seek if initial time has not been reached yet. This usually means
          // the seek ranges are not available yet.
          if (!initialTime.reached && time === initialTime.value) {
            queueSeek(time);
          }
          return false;
        } else {
          safeSeekTime = getSafeDvrSeekTime(_video, time);
          // We update the shift time now in order to make sure that the value
          // doesn't change after seeking, which would cause the playhead to jump.
          // This approach is less accurate but it's more user-friendly.
          currentTimeShift = getTimeShift(safeSeekTime);
        }
      } else {
        safeSeekTime = getSafeSeekTimeIfPossible(_video, time);
      }

      if (safeSeekTime !== null) {
        _video.currentTime = safeSeekTime;
        isSeeking = true;
        isWrapperSeeking = true;
        return true;
      }
      queueSeek(time);
      return false;
    };

    /**
     * Triggers a mute on the video element.
     * @public
     * @method OoyalaVideoWrapper#mute
     */
    this.mute = function() {
      _video.muted = true;
    };

    /**
     * Triggers an unmute on the video element.
     * @public
     * @method OoyalaVideoWrapper#unmute
     */
    this.unmute = function() {
      _video.muted = false;

      // workaround of an issue where some external SDKs (such those used in ad/video plugins)
      // are setting the volume to 0 when muting
      // Set the volume to our last known setVolume setting.
      // Since we're unmuting, we don't want to set volume to 0
      if (currentVolumeSet > 0) {
        this.setVolume(currentVolumeSet);
      }
    };

    /**
     * Checks to see if the video element is muted.
     * @public
     * @method OoyalaVideoWrapper#isMuted
     * @returns {boolean} True if the video element is muted, false otherwise
     */
    this.isMuted = function() {
      return _video.muted;
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method OoyalaVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = function(volume) {
      let resolvedVolume = volume;
      if (resolvedVolume < 0) {
        resolvedVolume = 0;
      } else if (resolvedVolume > 1) {
        resolvedVolume = 1;
      }

      currentVolumeSet = resolvedVolume;

      //  TODO check if we need to capture any exception here. ios device will not allow volume set.
      _video.volume = resolvedVolume;

      // If no video is assigned yet, the volumeChange event is not raised although it takes effect
      if (_video.currentSrc === '' || _video.currentSrc === null) {
        raiseVolumeEvent({ target: { volume: resolvedVolume } });
      }
    };

    /**
     * Gets the current time position of the video.
     * @public
     * @method OoyalaVideoWrapper#getCurrentTime
     * @returns {number} The current time position of the video (seconds)
     */
    this.getCurrentTime = function() {
      return _video.currentTime;
    };

    /**
     * Prepares a video element to be played via API.  This is called on a user click event, and is used in
     * preparing HTML5-based video elements on devices.  To prepare the element for playback, call play and
     * pause.  Do not raise playback events during this time.
     * @public
     * @method OoyalaVideoWrapper#primeVideoElement
     */
    this.primeVideoElement = function() {
      // We need to "activate" the video on a click so we can control it with JS later on mobile
      let playPromise = executePlay(true);
      // PLAYER-1323
      // Safar iOS seems to freeze when pausing right after playing when using preloading.
      // On this platform we wait for the play promise to be resolved before pausing.
      if (OO.isIos && playPromise && typeof playPromise.then === 'function') {
        ignoreFirstPlayingEvent = true;
        playPromise.then(function() {
          // There is no point in pausing anymore if actual playback has already been requested
          // by the time the promise is resolved
          if (!hasPlayed) {
            _video.pause();
          }
        });
        if (typeof playPromise.catch === 'function') {
          playPromise.catch(function() {
            ignoreFirstPlayingEvent = false;
          });
        }
      } else {
        _video.pause();
      }
    };

    /**
     * Applies the given css to the video element.
     * @public
     * @method OoyalaVideoWrapper#applyCss
     * @param {object} css The css to apply in key value pairs
     */
    this.applyCss = function(css) {
      $(_video).css(css);
    };

    /**
     * Destroys the individual video element.
     * @public
     * @method OoyalaVideoWrapper#destroy
     */
    this.destroy = function() {
      _video.pause();
      stopUnderflowWatcher();
      // On IE and Edge, setting the video source to an empty string has the unwanted effect
      // of a network request to the base url
      if (!OO.isIE && !OO.isEdge) {
        _video.src = '';
      }
      unsubscribeAllEvents();
      $(_video).remove();
      if (_playerId && currentInstances[_playerId] && currentInstances[_playerId] > 0) {
        currentInstances[_playerId]--;
      }
      if (watchHidden) {
        document.removeEventListener('visibilitychange', watchHidden);
      }
    };

    /**
     * Creates text tracks for any external VTT sources provided and sets the
     * mode of the track that matches the specified language to the specified mode.
     * In a general sense this method is used for enabling the captions of a
     * particular language.
     * @public
     * @method OoyalaVideoWrapper#setClosedCaptions
     * @param {String} language The key of the text track that we want to enable/change.
     * Usually a language code, but can also be the track id in the case of in-manifest
     * or in-stream text tracks.
     * @param {Object} closedCaptions An object containing a list of external VTT captions
     * that the player should display to the end user.
     * @param {Object} params An object containing additional parameters:
     *  - mode: (String) The mode to set on the track that matches the language parameter
     */
    this.setClosedCaptions = _.bind(function(language, closedCaptions = {}, params = {}) {
      OO.log('MainHtml5: setClosedCaptions called', language, closedCaptions, params);
      const vttClosedCaptions = closedCaptions.closed_captions_vtt || {};
      const externalCaptionsProvided = !!Object.keys(vttClosedCaptions).length;
      // Most browsers will require crossorigin=anonymous in order to be able to
      // load VTT files from a different domain. This needs to happen before any
      // tracks are added and, on Firefox, it also needs to be as early as possible
      // (hence why don't queue this part of the operation). Note that we only do this
      // if we're actually adding external tracks
      if (externalCaptionsProvided) {
        this.setCrossorigin('anonymous');

        for (let language in vttClosedCaptions) {
          externalCaptionsLanguages[language] = true;
        }
      }
      // Browsers tend to glitch when text tracks are added before metadata is
      // loaded and in some cases fail to trigger the first cue if a track is
      // added before canplay event is fired
      if (canPlay) {
        dequeueSetClosedCaptions();
        executeSetClosedCaptions.apply(this, arguments);
      } else {
        OO.log('MainHtml5: setClosedCaptions called before load, queing operation.');
        setClosedCaptionsQueue.push(arguments);
      }
    }, this);

    /**
     * The actual logic of setClosedCaptions() above. This is separated in order to
     * allow us to queue any calls to setClosedCaptions() that happen before metadata
     * is loaded.
     * @private
     * @method OoyalaVideoWrapper#executeSetClosedCaptions
     * @param {String} language The key of the text track that we want to enable/change.
     * Usually a language code, but can also be the track id in the case of in-manifest
     * or in-stream text tracks.
     * @param {Object} closedCaptions An object containing a list of external VTT captions
     * that the player should display to the end user.
     * @param {Object} params An object containing additional parameters:
     *  - mode: (String) The mode to set on the track that matches the language parameter
     */
    const executeSetClosedCaptions = (language, closedCaptions = {}, params = {}) => {
      const vttClosedCaptions = closedCaptions.closed_captions_vtt || {};
      const targetMode = params.mode || OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING;
      const targetTrack = textTrackHelper.findTrackByKey(language, textTrackMap);
      // Clear current CC cue if track is about to change
      if (currentCCKey !== language) {
        raiseClosedCaptionCueChanged('');
      }
      currentCCKey = language;
      // Start by disabling all tracks, except for the one whose mode we want to set
      disableTextTracksExcept(targetTrack);
      // Create tracks for all VTT captions from content tree that we haven't
      // added before. If the track with the specified language is added, it
      // will be created with the desired mode automatically
      const wasTargetTrackAdded = addExternalVttCaptions(
        vttClosedCaptions,
        language,
        targetMode
      );
      // If the desired track is not one of the newly added tracks then we set
      // the target mode on the pre-existing track that matches the target language
      if (!wasTargetTrackAdded) {
        setTextTrackMode(targetTrack, targetMode);
      }
    };

    /**
     * Sets the given text track mode for ALL existing tracks.
     * @public
     * @method OoyalaVideoWrapper#setClosedCaptionsMode
     * @param {string} mode The mode to set on the text tracks.
     * One of (OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED, OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN, OO.CONSTANTS.CLOSED_CAPTIONS.SHOWING).
     */
    this.setClosedCaptionsMode = (mode) => {
      textTrackHelper.forEach(textTrack =>
        setTextTrackMode(textTrack, mode)
      );

      if (mode === OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED) {
        raiseClosedCaptionCueChanged('');
      }
    };

    /**
     * Sets the crossorigin attribute on the video element.
     * @public
     * @method OoyalaVideoWrapper#setCrossorigin
     * @param {string} crossorigin The value to set the crossorigin attribute. Will remove crossorigin attribute if null.
     */
    this.setCrossorigin = function(crossorigin) {
      if (crossorigin) {
        // [PBW-6882]
        // There's a strange bug in Safari on iOS11 that causes CORS errors to be
        // incorrectly thrown when setting the crossorigin attribute after a video has
        // played without it. This usually happens when a video with CC's is played
        // after a preroll that's not using crossorigin.
        // At the time of writing iOS Safari doesn't seem to enforce same origin policy
        // for either HLS manifests/segments or VTT files. We avoid setting crossorigin
        // as a workaround for iOS 11 since it currently appears to not be needed.
        const iosVersion = 11;
        let isIos11 = OO.isIos && OO.iosMajorVersion === iosVersion;

        if (!isIos11) {
          $(_video).attr('crossorigin', crossorigin);
        }
      } else {
        $(_video).removeAttr('crossorigin');
      }
    };

    /**
     * For multi audio we can get a list of available audio tracks
     * @public
     * @method OoyalaVideoWrapper#getAvailableAudio
     * @returns {Array} - an array of all available audio tracks.
     */
    this.getAvailableAudio = function() {
      let audioTracks = _video.audioTracks;
      let audioTrackList = [];
      if (audioTracks !== undefined && audioTracks.length) {
        audioTracks = _.filter(audioTracks, function(track) {
          return track;
        });
        audioTrackList = _.map(audioTracks, function(track) {
          return {
            id: track.id,
            label: track.label,
            lang: track.language,
            enabled: track.enabled,
          };
        }, this);
      }
      return audioTrackList;
    };

    /**
     * Sets the audio track to the ID specified by trackID
     * @public
     * @method OoyalaVideoWrapper#setAudio
     * @param {String} trackId - the ID of the audio track to activate
     * @callback OoyalaVideoFactory#raiseAudioChange
     */
    this.setAudio = function(trackId) {
      let audioTracks = _video.audioTracks;
      if (audioTracks && audioTracks.length) { // if audioTracks exist
        let currentAudio = _.find(audioTracks, function(track) {
          return track.enabled;
        });
        let currentAudioId = null;
        if (currentAudio && currentAudio.id) {
          currentAudioId = currentAudio.id;
          if (currentAudioId !== trackId) {
            let newAudioTrack = audioTracks.getTrackById(trackId);
            if (newAudioTrack) { // if trackId is correct and the audio exists
              let prevAudioTrack = audioTracks.getTrackById(currentAudioId);
              if (prevAudioTrack) { // if currentAudioId is correct and the audio exists
                prevAudioTrack.enabled = false; // the audio is not active anymore
              }
              newAudioTrack.enabled = true; // the audio is active
            }
          }
        }
      }

      // audioTracks right now is Array-like, not actually an array
      // so we need to make it so
      let newTracks = this.getAvailableAudio();
      raiseAudioChange(newTracks);
    };

    /**
     * Set the playback speed of the video element
     * @public
     * @method OoyalaVideoWrapper#setPlaybackSpeed
     * @param  {number} speed The desired speed multiplier
     */
    this.setPlaybackSpeed = function(speed) {
      if (typeof speed !== 'number' || isNaN(speed)) {
        return;
      }
      // if we are playing a live asset, set the playback speed back to 1. This is
      // just in case we have somehow missed reseting the speed somewhere else.
      if (isLive) {
        currentPlaybackSpeed = 1.0;
      } else {
        currentPlaybackSpeed = speed;
      }

      if (_video) {
        _video.playbackRate = currentPlaybackSpeed;
      }
    };

    /**
     * Get the current speed multiplier for video elements.
     * @public
     * @method OoyalaVideoWrapper#getPlaybackSpeed
     * @returns {number} Current playback speed multiplier
     */
    this.getPlaybackSpeed = function() {
      return currentPlaybackSpeed;
    };

    // **********************************************************************************/
    // Event callback methods
    // **********************************************************************************/

    /**
     * Stores the url of the video when load is started.
     * @private
     * @method OoyalaVideoWrapper#onLoadStart
     */
    const onLoadStart = _.bind(function() {
      stopUnderflowWatcher();
      _currentUrl = _video.src;
      firstPlay = true;
      videoEnded = false;
      isSeeking = false;
    }, this);

    /**
     * When metadata is done loading, trigger any seeks that were queued up.
     * @private
     * @method OoyalaVideoWrapper#onLoadedMetadata
     */
    const onLoadedMetadata = _.bind(function() {
      if (_video.textTracks) {
        _video.textTracks.onaddtrack = onTextTracksAddTrack;
        _video.textTracks.onchange = onTextTracksChange;
      }

      if (_video.audioTracks) {
        _video.audioTracks.onchange = _onAudioChange;
      }

      dequeueSeek();
      isLive = isLive || _video.currentTime === Infinity; // Just in case backend and video metadata disagree about this
      if (isLive) {
        this.setPlaybackSpeed(1.0);
      }
      loaded = true;
    }, this);

    /**
     * Fired when there's a change on audioTracks
     * @private
     * @method OoyalaVideoFactory#onAudioChange
     * @callback OoyalaVideoFactory#raiseAudioChange
     */
    const _onAudioChange = _.bind(function(event) {
      let audioTracks = this.getAvailableAudio();
      raiseAudioChange(audioTracks);
    }, this);

    /**
     * Raised notification to VideoController
     * @private
     * @method OoyalaVideoFactory#onAudioChange
     * @fires VideoController#EVENTS.MULTI_AUDIO_CHANGE
     */
    const raiseAudioChange = _.bind(function(audioTracks) {
      // the problem here is that onchange gets triggered twice so
      // we compare old this.audioTracks with new audioTracks
      // to get updated tracks just once
      if (!_.isEqual(this.audioTracks, audioTracks)) {
        this.audioTracks = audioTracks;
        this.controller.notify(this.controller.EVENTS.MULTI_AUDIO_CHANGED, audioTracks);
      }
    }, this);

    /**
     * Fired by the browser when new text tracks are added.
     * @method OoyalaVideoWrapper#onTextTracksAddTrack
     * @private
     */
    const onTextTracksAddTrack = () => {
      // Update our internal map of available text tracks
      tryMapTextTracks();
      // Notify core about closed captions available after the change
      checkForAvailableClosedCaptions();
    };

    /**
     * Fired by the browser when there is a change on a text track. We use this
     * handler in order to compare text track modes against our own records in
     * order to determine whether changes have been made by the native UI (mostly
     * for iOS fullscreen mode).
     * @private
     * @method OoyalaVideoWrapper#onTextTracksChange
     */
    const onTextTracksChange = () => {
      let newLanguage;
      const changedTracks = textTrackHelper.filterChangedTracks(textTrackMap);
      // Changed tracks are any whose mode is different from the one we last
      // recorded on our text track map (i.e. the ones changed by the native UI)
      for (let changedTrack of changedTracks) {
        const trackMetadata = textTrackMap.findEntry({
          textTrack: changedTrack,
        });
        // We assume that any changes that occur prior to playback are browser
        // defaults since the native UI couldn't have been displayed yet
        if (!canPlay) {
          OO.log('MainHtml5: Native CC changes detected before playback, ignoring.');
          changedTrack.mode = trackMetadata.mode;
          continue;
        }
        // Changed tracks will come in pairs (one disabled, one enabled), except when
        // captions are turned off, in which case there should be a single disabled track
        if (changedTrack.mode === OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED) {
          // This will be none when all changed tracks are disabled
          newLanguage = newLanguage || 'none';
        // A single enabled track (without a corresponding disabled track) indicates
        // that the browser is forcing its default language. The exception to this is
        // when all tracks were previously disabled, which means that captions were
        // enabled by the user via the native UI
        } else if (!textTrackMap.areAllDisabled() && changedTracks.length === 1) {
          OO.log('MainHtml5: Default browser CC language detected, ignoring in favor of plugin default');
        } else {
          const useLanguageAsKey = !!(
            trackMetadata.isExternal ||
            externalCaptionsLanguages[trackMetadata.language]
          );
          // We give priority to external VTT captions but Safari might pick an
          // in-stream/in-manifest track when a CC language is chosen using the
          // native UI. We make sure to enable the equivalent external track
          // whenever both internal and external tracks exist for the same language
          newLanguage = useLanguageAsKey ? trackMetadata.language : trackMetadata.id;
        }
        // Whether we're ignoring or propagating the changes we revert the track to
        // it's last known mode. If there's a need for a language change it will
        // happen as a result of the notification below
        changedTrack.mode = trackMetadata.mode;
      }
      // Native text track change detected, update our own UI
      if (newLanguage) {
        this.controller.notify(
          this.controller.EVENTS.CAPTIONS_LANGUAGE_CHANGE,
          { language: newLanguage }
        );
        OO.log(`MainHtml5: CC track has been changed to "${newLanguage}" by the native UI`);
      }
    };

    /**
     * Callback for when a closed caption track cue has changed.
     * @private
     * @method OoyalaVideoWrapper#onClosedCaptionCueChange
     * @param {object} event The event from the cue change
     */
    let onClosedCaptionCueChange = _.bind(function(event) {
      let cueText = '';
      if (event && event.currentTarget && event.currentTarget.activeCues) {
        for (let index = 0; index < event.currentTarget.activeCues.length; index++) {
          if (event.currentTarget.activeCues[index].text) {
            cueText += event.currentTarget.activeCues[index].text + '\n';
          }
        }
      }
      raiseClosedCaptionCueChanged(cueText);
    }, this);

    /**
     * Notify the controller with new closed caption cue text.
     * @private
     * @method OoyalaVideoWrapper#raiseClosedCaptionCueChanged
     * @param {string} cueText The text of the new closed caption cue. Empty string signifies no active cue.
     */
    const raiseClosedCaptionCueChanged = _.bind(function(cueText) {
      const _cueText = cueText.trim();
      if (_cueText !== lastCueText) {
        lastCueText = _cueText;
        this.controller.notify(this.controller.EVENTS.CLOSED_CAPTION_CUE_CHANGED, _cueText);
      }
    }, this);

    /**
     * Notifies the controller that a progress event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseProgress
     * @param {object} event The event from the video
     */
    const raiseProgress = _.bind(function(event) {
      let buffer = 0;
      if (event.target.buffered && event.target.buffered.length > 0) {
        buffer = event.target.buffered.end(0); // in sec;
      }

      // Progress updates mean seekable ranges could be available so let's attempt to dequeue the seek
      if (isLive) {
        dequeueSeek();
      }

      if (!handleFailover) {
        this.controller.notify(this.controller.EVENTS.PROGRESS,
          { 'currentTime': event.target.currentTime,
            'duration': resolveDuration(event.target.duration),
            'buffer': buffer,
            'seekRange': getSafeSeekRange(event.target.seekable),
          });
      }
    }, this);

    /**
     * Notifies the controller that an error event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseErrorEvent
     * @param {object} event The event from the video
     */
    const raiseErrorEvent = _.bind(function(event) {
      stopUnderflowWatcher();

      let code = event.target.error ? event.target.error.code : -1;
      // Suppress error code 4 when raised by a video element with a null or empty src
      const errorCode = 4;
      if (!(code === errorCode &&
        ($(event.target).attr('src') === 'null' || $(event.target).attr('src') === ''))) {
        this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: code });
      }
    }, this);

    /**
     * Notifies the controller that a stalled event was raised.  Pauses the video on iPad if the currentTime is 0.
     * @private
     * @method OoyalaVideoWrapper#raiseStalledEvent
     * @param {object} event The event from the video
     */
    const raiseStalledEvent = _.bind(function(event) {
      // Fix multiple video tag error in iPad
      if (OO.isIpad && event.target.currentTime === 0) {
        _video.pause();
      }

      this.controller.notify(this.controller.EVENTS.STALLED, { 'url': _video.currentSrc });
    }, this);

    /**
     * HTML5 video browser can start playing the media. Sets canPlay flag to TRUE
     * @private
     * @method OoyalaVideoWrapper#raiseCanPlay
     */
    const raiseCanPlay = _.bind(function() {
      // On firefox and iOS, at the end of an underflow the video raises 'canplay' instead of
      // 'canplaythrough'.  If that happens, raise canPlayThrough.
      if ((OO.isFirefox || OO.isIos) && waitingEventRaised) {
        raiseCanPlayThrough();
      }
      canPlay = true;

      // Notify controller of video width and height.
      if (firstPlay) {
        // Dequeue any calls to setClosedCaptions() that occurred before
        // the video was loaded
        dequeueSetClosedCaptions();

        this.controller.notify(this.controller.EVENTS.ASSET_DIMENSION,
          { width: _video.videoWidth, height: _video.videoHeight });

        let availableAudio = this.getAvailableAudio();
        if (availableAudio && availableAudio.length > 1) {
          this.audioTracks = availableAudio;
          this.controller.notify(this.controller.EVENTS.MULTI_AUDIO_AVAILABLE, availableAudio);
        }
      }
    }, this);

    /**
     * Notifies the controller that a buffered event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseCanPlayThrough
     */
    const raiseCanPlayThrough = _.bind(function() {
      waitingEventRaised = false;
      this.controller.notify(this.controller.EVENTS.BUFFERED, { 'url': _video.currentSrc });
    }, this);

    /**
     * Notifies the controller that a playing event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePlayingEvent
     */
    const raisePlayingEvent = _.bind(function() {
      // Do not raise playback events if the video is priming
      if (isPriming) {
        return;
      }

      if (_video && pauseOnPlaying) {
        _video.pause();
        return;
      }

      // Update time shift in case the video was paused and then resumed,
      // which means that we were falling behind the live playhead while the video
      // wasn't playing. Note that Safari will sometimes keep loading the live content
      // in the background and will resume with the latest content. Time shift should
      // resolve to the same value in those cases.
      if (!firstPlay && wasPausedBeforePlaying && isDvrAvailable()) {
        currentTimeShift = getTimeShift(_video.currentTime);
      }

      hasStartedPlaying = true;

      // We want the initial PLAYING event to be from the play promise if play promises
      // are supported. This is to help with the muted autoplay workflow.
      // We want to ignore any playing events thrown by plays started with play promises
      if (!ignoreFirstPlayingEvent) {
        this.controller.notify(this.controller.EVENTS.PLAYING);
      }

      startUnderflowWatcher();

      ignoreFirstPlayingEvent = false;
      firstPlay = false;
      canSeek = true;
      isSeeking = false;
      wasPausedBeforePlaying = false;
    }, this);

    /**
     * Notifies the controller that a waiting event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseWaitingEvent
     */
    const raiseWaitingEvent = _.bind(function() {
      // WAITING event is not raised if no video is assigned yet
      if (_.isEmpty(_video.currentSrc)) {
        return;
      }
      waitingEventRaised = true;
      this.controller.notify(this.controller.EVENTS.WAITING, { 'url': _video.currentSrc });
    }, this);

    /**
     * Notifies the controller that a seeking event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseSeekingEvent
     */
    const raiseSeekingEvent = _.bind(function() {
      isSeeking = true;

      // Do not raise playback events if the video is priming
      // If the stream is seekable, supress seeks that come before or at the time initialTime is been reached
      // or that come while seeking.
      if (!isPriming && initialTime.reached) {
        this.controller.notify(this.controller.EVENTS.SEEKING);
      }
    }, this);

    /**
     * Notifies the controller that a seeked event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseSeekedEvent
     */
    const raiseSeekedEvent = _.bind(function(event) { // Firefox known issue: lack of global event.
      isSeeking = false;

      // After done seeking, see if any play events were received and execute them now
      // This fixes an issue on iPad where playing while seeking causes issues with end of stream eventing.
      dequeuePlay();

      // PBI-718 - If seeking is disabled and a native seek was received, seek back to the previous position.
      // This is required for platforms with native controls that cannot be disabled, such as iOS
      if (this.disableNativeSeek) {
        let fixedSeekedTime = Math.floor(_video.currentTime);
        let fixedCurrentTime = Math.floor(currentTime);
        if (fixedSeekedTime !== fixedCurrentTime) {
          _video.currentTime = currentTime;
        }
      }

      // Code below is mostly for fullscreen mode on iOS, where the video can be seeked
      // using the native player controls. We haven't updated currentTimeShift in this case,
      // so we do it at this point in order to show the correct shift in our inline controls
      // when the user exits fullscreen mode.
      if (isDvrAvailable() && !isWrapperSeeking) {
        // Seeking wasn't initiated by the wrapper, which means this is a native seek
        currentTimeShift = getTimeShift(_video.currentTime);
      }
      isWrapperSeeking = false;

      // If the stream is seekable, suppress seeks that come before or at the time initialTime is been reached
      // or that come while seeking.
      if (!initialTime.reached) {
        checkInitialTimeReached();
      } else {
        this.controller.notify(this.controller.EVENTS.SEEKED);
        raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event); // Firefox and Safari seek from paused state.
      }
    }, this);

    /**
     * Notifies the controller that a ended event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseEndedEvent
     */
    const raiseEndedEvent = _.bind(function(event) {
      stopUnderflowWatcher();
      if (videoEnded || // no double firing ended event
        !_currentUrl || // iOS Safari will trigger an ended event when the source is cleared with an empty string
        (OO.isEdge && !event) || // Edge fires empty ended event in the beginning on some mp4
        (!_video.ended && OO.isSafari) // iOS raises ended events sometimes when a new stream is played in the same video element
        // Prevent this faulty event from making it to the player message bus
      ) {
        return;
      }

      videoEnded = true;
      initialTime.value = 0;

      this.controller.notify(this.controller.EVENTS.ENDED);
    }, this);

    /**
     * Notifies the controller that the duration has changed.
     * @private
     * @method OoyalaVideoWrapper#raiseDurationChange
     * @param {object} event The event from the video
     */
    const raiseDurationChange = _.bind(function(event) {
      if (!handleFailover) {
        raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
      }
    }, this);

    /**
     * Checks to see if the initial time has been reached. Will update related states if initial
     * time has been reached.
     * @private
     * @method OoyalaVideoWrapper#checkInitialTimeReached
     */
    const checkInitialTimeReached = () => {
      let currentTime = _video.currentTime;
      if (!initialTime.reached && initialTime.value >= 0 && currentTime >= initialTime.value) {
        initialTime.reached = true;
        initialTime.value = 0;
      }
    };

    /**
     * Notifies the controller that the time position has changed.  Handles seeks if seeks were enqueued and
     * the stream has become seekable.  Triggers end of stream for m3u8 if the stream won't raise it itself.
     * @private
     * @method OoyalaVideoWrapper#raiseTimeUpdate
     * @param {object} event The event from the video
     */
    const raiseTimeUpdate = _.bind(function(event) {
      if (!isSeeking) {
        currentTime = _video.currentTime;
      }

      checkInitialTimeReached();

      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, event);

      // iOS has issues seeking so if we queue a seek handle it here
      dequeueSeek();

      forceEndOnTimeupdateIfRequired(event);
    }, this);

    /**
     * Notifies the controller that the play event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePlayEvent
     * @param {object} event The event from the video
     */
    const raisePlayEvent = _.bind(function(event) {
      // Do not raise playback events if the video is priming
      if (isPriming) {
        return;
      }

      this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
    }, this);

    /**
     * Notifies the controller that the pause event was raised.
     * @private
     * @method OoyalaVideoWrapper#raisePauseEvent
     */
    const raisePauseEvent = _.bind(function() {
      // Do not raise playback events if the video is priming
      if (isPriming) {
        return;
      }
      wasPausedBeforePlaying = true;
      if (!(OO.isIpad && _video.currentTime === 0)) {
        this.controller.notify(this.controller.EVENTS.PAUSED);
      }
      forceEndOnPausedIfRequired();
    }, this);

    /**
     * IOS native player adds attribute "controls" to video tag.
     * This function removes the attribute on IOS if it is necessary
     * @private
     * @method OoyalaVideoWrapper#removeControlsAttr
     */
    const removeControlsAttr = _.bind(function() {
      if (OO.isIos && _video.hasAttribute('controls')) {
        _video.removeAttribute('controls');
      }
    });

    /**
     * Notifies the controller that the ratechange event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseRatechangeEvent
     */
    const raiseRatechangeEvent = _.bind(function() {
      let playbackRate = _video ? _video.playbackRate : null;

      this.controller.notify(this.controller.EVENTS.PLAYBACK_RATE_CHANGE, {
        playbackRate: playbackRate,
      });
    }, this);

    /**
     * Notifies the controller that the volume event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseVolumeEvent
     * @param {object} event The event raised by the video.
     */
    const raiseVolumeEvent = _.bind(function(event) {
      this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { volume: event.target.volume });
      this.controller.notify(this.controller.EVENTS.MUTE_STATE_CHANGE, { muted: _video.muted });
    }, this);

    /**
     * Notifies the controller that the fullscreenBegin event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseFullScreenBegin
     * @param {object} event The event raised by the video.
     */
    const raiseFullScreenBegin = _.bind(function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
        { isFullScreen: true, paused: event.target.paused });
    }, this);

    /**
     * Notifies the controller that the fullscreenEnd event was raised.
     * @private
     * @method OoyalaVideoWrapper#raiseFullScreenEnd
     * @param {object} event The event raised by the video.
     */
    const raiseFullScreenEnd = _.bind(function(event) {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
        { 'isFullScreen': false, 'paused': event.target.paused });
      removeControlsAttr();
    }, this);

    /************************************************************************************/
    // Helper methods
    /************************************************************************************/

    /**
     * Sequentially executes all the setClosedCaptions() calls that have
     * been queued. The queue is cleared as a result of this operation.
     * @private
     * @method OoyalaVideoWrapper#dequeueSetClosedCaptions
     */
    const dequeueSetClosedCaptions = _.bind(function() {
      let queuedArguments;
      // eslint-disable-next-line
      while (queuedArguments = setClosedCaptionsQueue.shift()) {
        executeSetClosedCaptions.apply(this, queuedArguments);
      }
    }, this);

    /**
     * Sets the mode of all text tracks to 'disabled' except for targetTrack.
     * @private
     * @method OoyalaVideoWrapper#disableTextTracksExcept
     * @param {String} targetTrack The text track which we want to exclude from the disable operation.
     */
    const disableTextTracksExcept = (targetTrack) => {
      // Start by disabling all tracks, except for the one whose mode we want to set
      textTrackHelper.forEach(textTrack => {
        // Note: Edge will get stuck on 'disabled' mode if you disable a track right
        // before setting another mode on it, so we avoid disabling the target track
        if (textTrack !== targetTrack) {
          setTextTrackMode(textTrack, OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED);
        }
      });
    };

    /**
     * Creates text tracks for all of the given external VTT captions. If any of
     * the newly added tracks matches the targetLanguage then its mode will be set
     * to targetMode. Note that the mode can't be set at creation time, so this
     * happens when the addtrack event is fired.
     * @private
     * @method OoyalaVideoWrapper#addExternalVttCaptions
     * @param {Object} vttClosedCaptions A metadata object that containing a list of external VTT captions
     * that the player should display to the end user.
     * @param {String} targetLanguage The language or key of the track that should be set to targetMode
     * (usually the language that should be active).
     * @param {String} targetMode The mode that should be set on the track that matches targetLanguage.
     * @returns {Boolean} True if a track that matches targetLanguage was added as a result of this call, false otherwise.
     */
    const addExternalVttCaptions = (vttClosedCaptions = {}, targetLanguage, targetMode) => {
      let wasTargetTrackAdded = false;

      for (let language in vttClosedCaptions) {
        const trackData = Object.assign(
          { language: language },
          vttClosedCaptions[language]
        );
        const existsTrack = textTrackMap.existsEntry({
          src: trackData.url,
        });
        // Only add tracks whose source url hasn't been added before
        if (!existsTrack) {
          addExternalCaptionsTrack(trackData, targetLanguage, targetMode);

          if (language === targetLanguage) {
            wasTargetTrackAdded = true;
          }
        }
      }
      return wasTargetTrackAdded;
    };

    /**
     * Creates a single TextTrack object using the values provided in trackData.
     * The new track's mode will be set to targetMode after creation if the track
     * matches targetLanguage. Tracks that don't match targetLanguage will have a
     * 'disabled' mode by default.
     * @private
     * @method OoyalaVideoWrapper#addExternalCaptionsTrack
     * @param {Object} trackData An object with the following properties:
     *  - url: {String} The url of a source VTT file
     *  - name: {String} The label to display for this track
     *  - language: {String} The language code of the closed captions
     * @param {String} targetLanguage The language or key of the track that should be set to targetMode
     * (usually the language that should be active).
     * @param {String} targetMode The mode that should be set on the track that matches targetLanguage.
     */
    const addExternalCaptionsTrack = (trackData = {}, targetLanguage, targetMode) => {
      let trackMode;
      // Disable new tracks by default unless their language matches the language
      // that is meant to be active
      if (trackData.language === targetLanguage) {
        trackMode = targetMode;
      } else {
        trackMode = OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED;
      }
      // Keep a record of all the tracks that we add
      const trackId = textTrackMap.addEntry({
        src: trackData.url,
        label: trackData.name,
        language: trackData.language,
        mode: trackMode,
      }, true);
      // Create the actual TextTrack object
      textTrackHelper.addTrack({
        id: trackId,
        kind: CONSTANTS.TEXT_TRACK.KIND.SUBTITLES,
        // IMPORTANT:
        // We initially set the label to trackId since it's the only
        // cross-browser way to indentify the track after it's created
        label: trackId,
        srclang: trackData.language,
        src: trackData.url,
      });
      // MS Edge doesn't fire the addtrack event for manually added tracks
      if (OO.isEdge) {
        onTextTracksAddTrack();
      }
    };

    /**
     * Registers unknown text tracks in our text track map and ensures that
     * any tracks that we add have the track mode that corresponds to them.
     * This method is called when there are text track changes such as when the
     * addtrack or removetrack events are fired.
     * @private
     * @method OoyalaVideoWrapper#tryMapTextTracks
     */
    const tryMapTextTracks = () => {
      textTrackHelper.forEach(textTrack => {
        // Any tracks that have a track id as a label are known to be external
        // VTT tracks that we recently added. We rely on the label as the only
        // cross-browser way to identify a TextTrack object after its creation
        const trackMetadata = textTrackMap.findEntry({
          id: textTrack.label,
        });

        if (trackMetadata) {
          OO.log('MainHtml5: Registering newly added text track:', trackMetadata.id);
          // Store a reference to the track on our track map in order to link
          // related metadata
          textTrackMap.tryUpdateEntry(
            { id: trackMetadata.id },
            { textTrack: textTrack }
          );
          // Now that we've linked the TextTrack object to our map, we no longer
          // need the label in order to identify the track. We can set the actual
          // label on the track at this point
          textTrackHelper.updateTrackLabel(trackMetadata.id, trackMetadata.label);
          // Tracks are added as 'disabled' by default so we make sure to set
          // the mode that we had previously stored for the newly added track.
          // Note that track mode can't be set during creation that's why we
          // need to wait until the browser reports the track addition.
          setTextTrackMode(textTrack, trackMetadata.mode);
        }
        // Add in-manifest/in-stream tracks to our text track map. All external
        // tracks are already known to us, so any unrecognized tracks are assumed
        // to be in-manifest/in-stream
        mapTextTrackIfUnknown(textTrack);
      });
    };

    /**
     * Adds in-manifest/in-stream tracks to our text track map in order to allow
     * us to keep track of their state and identify them by ids that we assign to them.
     * @private
     * @method OoyalaVideoWrapper#mapTextTrackIfUnknown
     * @param {TextTrack} textTrack The TextTrack object which we want to try to map.
     */
    const mapTextTrackIfUnknown = (textTrack) => {
      // Any unkown track is assumed to be an in-manifest/in-stream track since
      // we map external tracks when they are added
      const isKnownTrack = textTrackMap.existsEntry({
        textTrack: textTrack,
      });
      // Avoid mapping metadata and other non-subtitle track kinds
      const isTextTrack = (
        textTrack.kind === CONSTANTS.TEXT_TRACK.KIND.CAPTIONS ||
        textTrack.kind === CONSTANTS.TEXT_TRACK.KIND.SUBTITLES
      );
      // Add an entry to our text track map in order to be able to keep track of
      // the in-manifest/in-stream track's mode
      if (!isKnownTrack && isTextTrack) {
        OO.log('MainHtml5: Registering internal text track:', textTrack);

        textTrackMap.addEntry({
          label: textTrack.label,
          language: textTrack.language,
          mode: textTrack.mode,
          textTrack: textTrack,
        }, false);
      }
    };

    /**
     * Translates the tracks from the text track map into the format that the core
     * uses in order to determine available closed captions languages (or tracks).
     * Calling this function results in CAPTIONS_FOUND_ON_PLAYING being notified
     * with the current state of our text track map.
     * @method OoyalaVideoWrapper#checkForAvailableClosedCaptions
     * @private
     */
    const checkForAvailableClosedCaptions = () => {
      const closedCaptionInfo = {
        languages: [],
        locale: {},
      };
      const externalEntries = textTrackMap.getExternalEntries();
      const internalEntries = textTrackMap.getInternalEntries();
      // External tracks will override in-manifest/in-stream captions when languages
      // collide, so we add their info first
      for (let externalEntry of externalEntries) {
        closedCaptionInfo.languages.push(externalEntry.language);
        closedCaptionInfo.locale[externalEntry.language] = externalEntry.label;
      }
      // In-manifest/in-stream captions are reported with an id such as CC1 instead
      // of language in order to avoid conflicts with external VTTs
      for (let internalEntry of internalEntries) {
        // Either the language was already added to the info above or it is one
        // of the external captions that will be added after the video loads
        const isLanguageDefined = (
          !!closedCaptionInfo.locale[internalEntry.language] ||
          !!externalCaptionsLanguages[internalEntry.language]
        );
        // We do not report an in-manifest/in-stream track when its language is
        // already in use by external VTT captions
        if (!isLanguageDefined) {
          const key = internalEntry.id;
          const label = (
            internalEntry.label ||
            internalEntry.language ||
            `Captions (${key})`
          );
          // For in-manifest/in-stream we use id instead of language in order to
          // account for cases in which language metadata is unavailable and also
          // to avoid conflicts with external VTT captions
          closedCaptionInfo.languages.push(key);
          closedCaptionInfo.locale[key] = label;
        }
      }
      this.controller.notify(this.controller.EVENTS.CAPTIONS_FOUND_ON_PLAYING, closedCaptionInfo);
    };

    /**
     * Sets the given track mode on the given text track. The new mode is also
     * updated in the relevant text track map entry in order for us to be able to
     * detect native changes.
     * @private
     * @method OoyalaVideoWrapper#setTextTrackMode
     * @param {TextTrack} textTrack The TextTrack object whose mode we want to set.
     * @param {String} mode The mode that we want to set on the text track.
     */
    const setTextTrackMode = (textTrack, mode) => {
      if (textTrack && textTrack.mode !== mode) {
        textTrack.mode = mode;
        // Keep track of the latest mode that was set in order to be able to
        // detect any changes triggered by the native UI
        textTrackMap.tryUpdateEntry(
          { textTrack: textTrack },
          { mode: mode }
        );
        // Make sure to listen to cue changes on active tracks
        if (mode === OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED) {
          textTrack.oncuechange = null;
        } else {
          textTrack.oncuechange = onClosedCaptionCueChange;
        }
        OO.log('MainHtml5: Text track mode set:', textTrack.language, mode);
      }
    };

    /**
     * If any plays are queued up, execute them.
     * @private
     * @method OoyalaVideoWrapper#dequeuePlay
     */
    const dequeuePlay = _.bind(function() {
      if (playQueued) {
        playQueued = false;
        this.play();
      }
    }, this);

    /**
     * Loads (if required) and plays the current stream.
     * @private
     * @method OoyalaVideoWrapper#executePlay
     * @param {boolean} priming True if the element is preparing for device playback
     */
    const executePlay = _.bind(function(priming) {
      isPriming = priming;

      // TODO: Check if no src url is configured?
      if (!loaded) {
        this.load(true);
      }

      let playPromise = _video.play();

      if (!isPriming) {
        hasPlayed = true;
        videoEnded = false;
      }
      return playPromise;
    }, this);

    /**
     * Gets the range of video that can be safely seeked to.
     * @private
     * @method OoyalaVideoWrapper#getSafeSeekRange
     * @param {object} seekRange The seek range object from the video element.  It contains a length, a start
     *                           function, and an end function.
     * @returns {object} The safe seek range object containing { "start": number, "end": number}
     */
    const getSafeSeekRange = function(seekRange) {
      if (!seekRange || !seekRange.length || !(typeof seekRange.start === 'function') ||
          !(typeof seekRange.end === 'function')) {
        return { 'start': 0, 'end': 0 };
      }

      return { 'start': seekRange.length > 0 ? seekRange.start(0) : 0,
        'end': seekRange.length > 0 ? seekRange.end(0) : 0 };
    };

    /**
     * Gets the seekable object in a way that is safe for all browsers.  This fixes an issue where Safari
     * HLS videos become unseekable if 'seekable' is queried before the stream has raised 'canPlay'.
     * @private
     * @method OoyalaVideoWrapper#getSafeSeekableObject
     * @returns {object?} Either the video seekable object or null
     */
    const getSafeSeekableObject = function() {
      if (OO.isSafari && !canPlay) {
        // Safety against accessing seekable before SAFARI browser canPlay media
        return null;
      } else {
        return _video.seekable;
      }
    };

    /**
     * Converts the desired seek time to a safe seek time based on the duration and platform.  If seeking
     * within OO.CONSTANTS.SEEK_TO_END_LIMIT of the end of the stream, seeks to the end of the stream.
     * @private
     * @method OoyalaVideoWrapper#convertToSafeSeekTime
     * @param {number} time The desired seek-to position
     * @param {number} duration The video's duration
     * @returns {number} The safe seek-to position
     */
    const convertToSafeSeekTime = function(time, duration) {
      // If seeking within some threshold of the end of the stream, seek to end of stream directly
      if (duration - time < OO.CONSTANTS.SEEK_TO_END_LIMIT) {
        // eslint-disable-next-line
        time = duration;
      }
      let safeTime = time >= duration ? duration - 0.01 : (time < 0 ? 0 : time);

      // iPad with 6.1 has an interesting bug that causes the video to break if seeking exactly to zero
      if (OO.isIpad) {
        const minimumSafeTime = 0.1;
        if (safeTime < minimumSafeTime) {
          safeTime = minimumSafeTime;
        }
      }
      return safeTime;
    };

    /**
     * Returns the safe seek time if seeking is possible.  Null if seeking is not possible.
     * @private
     * @method OoyalaVideoWrapper#getSafeSeekTimeIfPossible
     * @param {object} _video The video element
     * @param {number} time The desired seek-to position
     * @returns {?number} The seek-to position, or null if seeking is not possible
     */
    const getSafeSeekTimeIfPossible = function(_video, time) {
      if ((typeof time !== 'number') || !canSeek) {
        return null;
      }

      let range = getSafeSeekRange(getSafeSeekableObject());
      if (range.start === 0 && range.end === 0) {
        return null;
      }

      let safeTime = convertToSafeSeekTime(time, _video.duration);
      if (range.start <= safeTime && range.end >= safeTime) {
        return safeTime;
      }

      return null;
    };

    /**
     * Returns the actual playhead time that we need to seek to in order to shift to a time in
     * the DVR window represented by a number from 0 to DVR Window Length. The values returned
     * are always constrained to the size of the DVR window.
     * @private
     * @method OoyalaVideoWrapper#getSafeDvrSeekTime
     * @param {HTMLVideoElement} video The video element on which the DVR-enabled stream is loaded.
     * @param {Number} seekTime The time from 0 to DVR Window Length to which we want to shift.
     * @returns {Number} The playhead time that corresponds to the given DVR window position (seekTime).
     * The return value will be constrained to valid values within the DVR window. The current playhead
     * will be returned when seekTime is not a valid, finite or positive number.
     */
    const getSafeDvrSeekTime = function(video, seekTime) {
      // Note that we set seekTime to an invalid negative value if not a number
      const _seekTime = ensureNumber(seekTime, -1);
      // When seekTime is negative or not a valid number, return the current time
      // in order to avoid seeking
      if (_seekTime < 0) {
        return (video || {}).currentTime || 0;
      }
      let seekRange = getSafeSeekRange(getSafeSeekableObject());
      let safeSeekTime = seekRange.start + _seekTime;
      // Make sure seek time isn't larger than maximum seekable value, if it is,
      // seek to maximum value instead
      safeSeekTime = Math.min(safeSeekTime, seekRange.end);
      return safeSeekTime;
    };

    /**
     * Adds the desired seek time to a queue so as to be used later.
     * @private
     * @method OoyalaVideoWrapper#queueSeek
     * @param {number} time The desired seek-to position
     */
    const queueSeek = function(time) {
      queuedSeekTime = time;
    };

    /**
     * If a seek was previously queued, triggers a seek to the queued seek time.
     * @private
     * @method OoyalaVideoWrapper#dequeueSeek
     */
    const dequeueSeek = _.bind(function() {
      if (queuedSeekTime === null) { return; }
      let seekTime = queuedSeekTime;
      queuedSeekTime = null;
      this.seek(seekTime);
    }, this);

    /**
     * Determines whether or not the current stream has DVR currently enabled.
     * @private
     * @method OoyalaVideoWrapper#isDvrAvailable
     * @returns {Boolean} True if DVR is available, false otherwise.
     */
    const isDvrAvailable = function() {
      let maxTimeShift = getMaxTimeShift();
      let result = maxTimeShift !== 0;
      return result;
    };

    /**
     * Returns the current time shift offset to the live edge in seconds for DVR-enabled streams.
     * @private
     * @method OoyalaVideoWrapper#getTimeShift
     * @param {number} currentTime currentTime
     * @returns {Number} The negative value of the current time shift offset, in seconds. Returns 0
     * if currently at the live edge.
     */
    const getTimeShift = function(currentTime) {
      if (!isLive) {
        return 0;
      }
      let timeShift = 0;
      let seekRange = getSafeSeekRange(getSafeSeekableObject());
      // If not a valid number set to seekRange.end so that timeShift equals zero
      const _currentTime = ensureNumber(currentTime, seekRange.end);
      timeShift = _currentTime - seekRange.end;
      // Discard positive time shifts
      timeShift = Math.min(timeShift, 0);
      // Shouldn't be greater than max time shift
      timeShift = Math.max(timeShift, getMaxTimeShift());
      return timeShift;
    };

    /**
     * Returns the max amount of time that the video can be seeked back for DVR-enabled
     * live streams. The value of maxTimeShift is represented as a negative number.
     * @private
     * @method OoyalaVideoWrapper#getMaxTimeShift
     * @returns {Number} The maximum amount of seconds that the current video can be seeked back
     * represented as a negative number, or zero, if DVR is not available.
     */
    const getMaxTimeShift = function() {
      if (!isLive) {
        return 0;
      }
      let maxShift = 0;
      let seekRange = getSafeSeekRange(getSafeSeekableObject());
      maxShift = seekRange.end - seekRange.start;
      maxShift = ensureNumber(maxShift, 0) > 0 ? -maxShift : 0;
      return maxShift;
    };

    /**
     * Notifies the controller of events that provide playhead information.
     * @private
     * @method OoyalaVideoWrapper#raisePlayhead
     */
    const raisePlayhead = _.bind(function(eventname, event) {
      // Do not raise playback events if the video is priming
      if (isPriming) {
        return;
      }
      // If the stream is seekable, supress playheads that come before the initialTime has been reached
      // or that come while seeking.
      // TODO: Check _video.seeking?
      if (isSeeking || initialTime.value > 0) {
        return;
      }

      let buffer = 0;
      let newCurrentTime = null;
      let currentLiveTime = 0;
      let duration = resolveDuration(event.target.duration);

      // Live videos without DVR (i.e. maxTimeShift === 0) are treated as regular
      // videos for playhead update purposes
      if (isDvrAvailable()) {
        let maxTimeShift = getMaxTimeShift();
        newCurrentTime = currentTimeShift - maxTimeShift;
        duration = -maxTimeShift;
        buffer = duration;
        // [PBW-5863] The skin displays current time a bit differently when dealing
        // with live video, but we still need to keep track of the actual playhead for analytics purposes
        currentLiveTime = _video.currentTime;
      } else {
        if (_video.buffered && _video.buffered.length > 0) {
          buffer = _video.buffered.end(0); // in seconds
        }
        // Just a precaution for older browsers, this should already be a number
        newCurrentTime = ensureNumber(_video.currentTime, null);
      }

      let seekable = getSafeSeekRange(getSafeSeekableObject());
      this.controller.notify(eventname, {
        currentTime: newCurrentTime,
        currentLiveTime: currentLiveTime,
        duration: duration,
        buffer: buffer,
        seekRange: seekable,
      });
    }, this);

    /**
     * Converts a value to a number or returns null if it can't be converted or is not a finite value.
     * @private
     * @method OoyalaVideoWrapper#ensureNumber
     * @param {*} value The value to convert.
     * @param {*} defaultValue A default value to return when the input is not a valid number.
     * @returns {Number} The Number equivalent of value if it can be converted and is finite.
     * When value doesn't meet the criteria the function will return either defaultValue (if provided) or null.
     */
    const ensureNumber = function(value, defaultValue) {
      let number;
      if (value === null || _.isArray(value)) {
        // eslint-disable-next-line
        value = NaN;
      }
      if (_.isNumber(value)) {
        number = value;
      } else {
        number = Number(value);
      }
      if (!isFinite(number)) {
        return (typeof defaultValue === 'undefined') ? null : defaultValue;
      }
      return number;
    };

    /**
     * Resolves the duration of the video to a valid value.
     * @private
     * @method OoyalaVideoWrapper#resolveDuration
     * @param {number} duration The reported duration of the video in seconds
     * @returns {number} The resolved duration of the video in seconds
     */
    const resolveDuration = function(duration) {
      if (duration === Infinity || isNaN(duration)) {
        return 0;
      }
      return duration;
    };

    /**
     * Safari desktop sometimes doesn't raise the ended event until the next time the video is played.
     * Force the event to come through by calling play if _video.ended to prevent it for coming up on the
     * next stream.
     * @private
     * @method OoyalaVideoWrapper#forceEndOnPausedIfRequired
     */
    const forceEndOnPausedIfRequired = _.bind(function() {
      if (OO.isSafari && !OO.isIos) {
        if (_video.ended) {
          console.log('VTC_OO: Force through the end of stream for Safari', _video.currentSrc,
            _video.duration, _video.currentTime);
          raiseEndedEvent();
        }
      }
    }, this);

    /**
     * Currently, iOS has a bug that if the m3u8 EXTINF indicates a different duration, the ended event never
     * gets dispatched.  Manually trigger an ended event on all m3u8 streams where duration is a non-whole
     * number.
     * @private
     * @method OoyalaVideoWrapper#forceEndOnTimeupdateIfRequired
     */
    const forceEndOnTimeupdateIfRequired = _.bind(function(event) {
      if (isM3u8) {
        let durationResolved = resolveDuration(event.target.duration);
        let durationInt = Math.floor(durationResolved);
        if ((_video.currentTime === durationResolved) && (durationResolved > durationInt)) {
          console.log('VTC_OO: manually triggering end of stream for m3u8',
            _currentUrl, durationResolved, _video.currentTime);
          _.defer(raiseEndedEvent);
        } else if (OO.isSafari && !OO.isIos && isSeeking === true &&
          !_video.ended && Math.round(_video.currentTime) === Math.round(_video.duration)) {
          this.controller.notify(this.controller.EVENTS.SEEKED);
          videoEnded = true;
          initialTime.value = 0;
          this.controller.notify(this.controller.EVENTS.ENDED);
        }
      }
    }, this);

    /**
     * Chrome does not raise a waiting event when the buffer experiences an underflow and the stream stops
     * playing.  To compensate, start a watcher that periodically checks the currentTime.  If the stream is
     * not advancing but is not paused, raise the waiting event once.
     * If the watcher has already been started, do nothing.
     * @private
     * @method OoyalaVideoWrapper#startUnderflowWatcher
     */
    const startUnderflowWatcher = _.bind(function() {
      if ((OO.isChrome || OO.isIos || OO.isIE11Plus || OO.isEdge) && !underflowWatcherTimer) {
        let watchInterval = 300;
        underflowWatcherTimer = setInterval(underflowWatcher, watchInterval);
      }
    }, this);

    /**
     * Periodically checks the currentTime.  If the stream is not advancing but is not paused, raise the
     * waiting event once.
     * @private
     * @method OoyalaVideoWrapper#underflowWatcher
     */
    const underflowWatcher = _.bind(function() {
      if (!hasPlayed) {
        return;
      }

      if (_video.ended) {
        return stopUnderflowWatcher();
      }

      if (!_video.paused && _video.currentTime === watcherTime) {
        if (!waitingEventRaised) {
          raiseWaitingEvent();
        }
      } else { // should be able to do this even when paused
        watcherTime = _video.currentTime;
        if (waitingEventRaised) {
          raiseCanPlayThrough();
        }
      }
    }, this);

    /**
     * Stops the interval the watches for underflow.
     * @private
     * @method OoyalaVideoWrapper#stopUnderflowWatcher
     */
    const stopUnderflowWatcher = _.bind(function() {
      clearInterval(underflowWatcherTimer);
      underflowWatcherTimer = null;
      waitingEventRaised = false;
      watcherTime = -1;
    }, this);
  };

  /**
   * Generates a random string.
   * @private
   * @method getRandomString
   * @returns {string} A random string
   */
  const getRandomString = function() {
    const radix = 36;
    const substringIndex = 7;
    return Math.random().toString(radix).substring(substringIndex);
  };

  OO.Video.plugin(new OoyalaVideoFactory());
}(OO._, OO.$));
