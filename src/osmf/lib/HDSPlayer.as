package
{
  import DynamicEvent;
  import ExternalJavaScriptAPI;
  
  import flash.display.Sprite;
  import flash.display.StageDisplayState;
  import flash.display.StageScaleMode;
  import flash.display.StageAlign;
  import flash.events.Event;
  import flash.events.FullScreenEvent;
  import flash.events.MouseEvent;
  import flash.events.TimerEvent;
  import flash.external.ExternalInterface;
  import flash.system.Security;
  import flash.text.TextField;
  import flash.text.TextFieldAutoSize;
  import flash.text.TextFormat;
  import flash.utils.Timer;
  
  import org.osmf.events.BufferEvent;
  import org.osmf.events.MediaElementEvent;
  import org.osmf.events.MediaErrorCodes;
  import org.osmf.events.MediaErrorEvent;
  import org.osmf.events.MediaFactoryEvent;
  import org.osmf.events.MediaPlayerStateChangeEvent;
  import org.osmf.events.SeekEvent;
  import org.osmf.events.TimeEvent;
  import org.osmf.events.DynamicStreamEvent;
  import org.osmf.layout.ScaleMode;
  import org.osmf.media.DefaultMediaFactory;
  import org.osmf.media.MediaElement;
  import org.osmf.media.MediaPlayerSprite;
  import org.osmf.media.MediaPlayerState;
  import org.osmf.media.MediaResourceBase;
  import org.osmf.media.PluginInfoResource;
  import org.osmf.media.URLResource;
  import org.osmf.metadata.Metadata;
  import org.osmf.metadata.TimelineMetadata;
  import org.osmf.net.StreamingURLResource;
  import org.osmf.traits.MediaTraitType;
  import org.osmf.traits.SeekTrait;
  
  public class HDSPlayer extends Sprite
  {
    private var _mediaFactory:DefaultMediaFactory = null;
    private var _mediaPlayerSprite:MediaPlayerSprite = null;
    private var _videoUrl:String = "";
    private var _initialTime:Number = 0;
    private var _initialTimeReference:Number = -1;
    private var _playheadTimer:Timer = null;
    private var _seekTrait:SeekTrait = null;
    private var _playerState:String = "";
    private var _playQueue:Boolean = false;
    private var _initialPlay:Boolean = true;
    private var _selectedCaptionLanguage:String = "";
    private var _captionObject:Object = new Object();
    private static const CAPTIONING_PLUGIN_INFO:String = "CaptioningPluginInfo";
    private var _captioningEnabled:Boolean;
    private var _captionMetadata:TimelineMetadata; 
    private var _captionLabel:TextField = new TextField();;
    private var _defaultCaptionFormat:TextFormat;
    private var _captionsURL:String;
    private var _resource:StreamingURLResource = null;
    private var _element:MediaElement;
    private var _captionFlag:Boolean = false;
    private var _loadFlag:Boolean = false;
    private var _mode:String;
    private var _captionRegionWidth:Number;
    private var _captionRegionHeight:Number;
    private var _captionMaxPlayerHeight:Number;
    private var _previousCaption:String = "";
    private var _previousSelectedCaptionLanguage:String = "";
    private var _selectedCaptionObject:Object = new Object();
    private var _currentCaption:Caption;
    public static const BASE_SCALE_FACTOR_HEIGHT:Number = 400;
    public static const BASE_SCALE_FACTOR:Number = 1;
    public var _bitrateArray:Array = new Array();
    public var _bitrateIdArray:Array = new Array();
    private var _currentBitrate:Number = -1;
    private var _hiddenCaptionFlag:Boolean = false;
    private var _previousCaptionMode:String;
    
    /**
     * Constructor
     * @public
     */
    public function HDSPlayer( )
    {
      Security.allowDomain("*");
      Security.allowInsecureDomain('*')

      var externalJavaScriptApi:ExternalJavaScriptAPI = new ExternalJavaScriptAPI(this);
    }
    
    /**
     * Registers the event listners
     * @public
     * @method HDSPlayer#registerListeners
     */
    private function registerListeners():void
    {
      _mediaPlayerSprite.mediaPlayer.addEventListener(MediaPlayerStateChangeEvent.MEDIA_PLAYER_STATE_CHANGE,
                                                      onPlayerStateChange);
      _mediaPlayerSprite.mediaPlayer.addEventListener(TimeEvent.COMPLETE, onPlayComplete);
      _mediaPlayerSprite.mediaPlayer.addEventListener(MediaErrorEvent.MEDIA_ERROR, onMediaError);
      _mediaPlayerSprite.mediaPlayer.addEventListener(BufferEvent.BUFFERING_CHANGE, bufferingChangeHandler);
      _mediaPlayerSprite.mediaPlayer.addEventListener(DynamicStreamEvent.SWITCHING_CHANGE, onBitrateChanged);
      CaptioningDocument.addEventListener(CaptioningDocument.CAPTION_READY, onCaptionready);
      stage.addEventListener(FullScreenEvent.FULL_SCREEN, resizeListener);
      stage.addEventListener(Event.RESIZE, resizeListener);
      SendToDebugger("events added", "registerListeners");
    }
    
    /**
     * Unregisters the event listners
     * @public
     * @method HDSPlayer#unregisterListeners
     */
    private function unregisterListeners():void
    {
      _mediaPlayerSprite.mediaPlayer.removeEventListener(MediaPlayerStateChangeEvent.MEDIA_PLAYER_STATE_CHANGE,
                                                         onPlayerStateChange);
      _mediaPlayerSprite.mediaPlayer.removeEventListener(TimeEvent.COMPLETE, onPlayComplete);
      _mediaPlayerSprite.mediaPlayer.removeEventListener(MediaErrorEvent.MEDIA_ERROR,onMediaError);
      _mediaPlayerSprite.mediaPlayer.removeEventListener(DynamicStreamEvent.SWITCHING_CHANGE, onBitrateChanged);
      CaptioningDocument.removeEventListener(CaptioningDocument.CAPTION_READY,onCaptionready);
      stage.removeEventListener(FullScreenEvent.FULL_SCREEN, resizeListener);
      stage.removeEventListener(Event.RESIZE, resizeListener);
      
      if (_seekTrait != null)
      {
        _seekTrait.removeEventListener(SeekEvent.SEEKING_CHANGE, onSeekingChange);
        _seekTrait = null;
      }
    }
    
    /**
     * Determines whether content is buffered
     * @public
     * @method HDSPlayer#unregisterListeners
     */
    private function bufferingChangeHandler(e:BufferEvent):void
    {
      if (!_mediaPlayerSprite.mediaPlayer.buffering)
      {
        SendToDebugger("buffering is finished", "buffering change handler");
        dispatchEvent(new DynamicEvent(DynamicEvent.BUFFERED,null));
      }
    }
    
    /**
     * Send messages to the browser console log.In future this can be hooked to any other Debugging tools.
     * @private
     * @method HDSPlayer#SendToDebugger
     * @param {string} value The value to be passed to the browser console.
     * @param {string} referrer The fuction or process which passed the value.
     * @param {string} channelBranch It can be info, debug, warn, error or log.
     * @returns {boolean} True or false indicating success
     */
    private function SendToDebugger(value:String, referrer:String = null, channelBranch:String = "log"):Boolean
    {
      var channel:String = "OO." + channelBranch;
      if (referrer) referrer = "[" + referrer + "]";
      var debugMessage:Boolean = ExternalInterface.call(channel, "HDSFlash " + channelBranch + " " +
                                                        referrer + ": " + value);
      return debugMessage;
    }
    
    /**
     * Creates the MediaPlayerSprite and DefaultMediaFactory instances.
     * @public
     * @method HDSPlayer#initMediaPlayer
     */
    public function initMediaPlayer():void
    {
      SendToDebugger("initMediaPlayer()", "initMediaPlayer");
      
      /* Creates a timer to keep track of the TIME_UPDATE event.
      The triggering value can be changed as per the specifications. */
      _playheadTimer = new Timer(250);
      _playheadTimer.addEventListener(TimerEvent.TIMER, onPlayheadUpdate);
      _playheadTimer.reset();
      
      // Create the container (sprite) for managing display and layout
      _mediaPlayerSprite = new MediaPlayerSprite();
      SendToDebugger("addEventListener added", "initMediaPlayer");
      //Adds the container to the stage
      addChild(_mediaPlayerSprite);
      _mediaFactory = new DefaultMediaFactory();
      
      SendToDebugger("_mediaFactory: " + _mediaFactory, "initMediaPlayer");
      loadPlugin(CAPTIONING_PLUGIN_INFO);
      registerListeners();
    }
    
    /**
     * Decides the type of the plugin's source and then loads it. 
     * @private
     * @method HDSPlayer#loadPlugin
     * @param {String} source Source of the plugin.
     */
    private function loadPlugin(source:String):void
    {
      var pluginResource:MediaResourceBase;
      if (source.substr(0, 4) == "http" || source.substr(0, 4) == "file")
      {
        // This is a URL, create a URLResource
        pluginResource = new URLResource(source);
      }
      else
      {
        // Assume this is a class
        var pluginInfoRef:Class = flash.utils.getDefinitionByName(source) as Class;
        pluginResource = new PluginInfoResource(new pluginInfoRef);
      }  
      loadPluginFromResource(pluginResource);
    }
    
    /**
     * Loads the plugin using plugin's resource.
     * @private
     * @method HDSPlayer#loadPluginFromResource
     * @param {MediaResourceBase} pluginResource Resource from where the plugin is loaded.
     */
    private function loadPluginFromResource(pluginResource:MediaResourceBase):void
    {
      _mediaFactory.addEventListener(MediaFactoryEvent.PLUGIN_LOAD, onPluginLoaded);
      _mediaFactory.addEventListener(MediaFactoryEvent.PLUGIN_LOAD_ERROR, onPluginLoadFailed);
      _mediaFactory.loadPlugin(pluginResource);
    }
    
    /**
     * Event listner for MediaFactoryEvent
     * @private
     * @method HDSPlayer#onPluginLoaded
     * @param {MediaFactoryEvent} event
     */
    private function onPluginLoaded( event:MediaFactoryEvent ):void
    {
      SendToDebugger("Plugin LOADED", "onPluginLoaded");
    }
    
    /**
     * Event listner for MediaFactoryEvent
     * @private
     * @method HDSPlayer#onPluginLoadFailed
     * @param {MediaFactoryEvent} event
     */
    private function onPluginLoadFailed( event:MediaFactoryEvent ):void
    {
      SendToDebugger("Plugin LOAD FAILED", "onPluginLoadFailed");
    }
    
    /**
     * Event listner for MediaPlayerStateChangeEvent
     * @private
     * @method HDSPlayer#onPlayerStateChange
     * @param {MediaPlayerStateChangeEvent} event
     */
    private function onPlayerStateChange(event:MediaPlayerStateChangeEvent):void
    {
      SendToDebugger("osmf state changed: " + event.state, "onPlayerStateChange");
      _playerState = event.state;
      
      switch(event.state)
      {
        case MediaPlayerState.PLAYING:
          if (_initialPlay)
          {
            //Sets initial time to duration when it is greater than duration
            if (_initialTime > _mediaPlayerSprite.mediaPlayer.duration)
            {
              _initialTime = (int) (_mediaPlayerSprite.mediaPlayer.duration); 
            }
            //Sets initial time to zero when it is less than zero
            else if (_initialTime < 0)
            {
              _initialTime = 0;
            }
            _initialPlay = false;
          }
          
          if (_playheadTimer.running==false && _initialTime==0)
          {
            _playheadTimer.start();
          }
          else if (_initialTime != 0)
          {
            _initialTimeReference = _initialTime;
            _seekTrait = _mediaPlayerSprite.mediaPlayer.media.getTrait(MediaTraitType.SEEK) as SeekTrait;
            _seekTrait.addEventListener(SeekEvent.SEEKING_CHANGE, onSeekingChange);
            _mediaPlayerSprite.mediaPlayer.seek(_initialTime);
            _initialTime = 0;
          }
          dispatchEvent(new DynamicEvent(DynamicEvent.PLAYING,null));
          break;
        case MediaPlayerState.PAUSED:
          dispatchEvent(new DynamicEvent(DynamicEvent.PAUSED,null));
          break;
        case MediaPlayerState.BUFFERING:
          dispatchEvent(new DynamicEvent(DynamicEvent.BUFFERING,null));
          break;
        case MediaPlayerState.PLAYBACK_ERROR:
          SendToDebugger("MediaPlayerState.PLAYBACK_ERROR", "onPlayerStateChange");
          break;
        case MediaPlayerState.LOADING:
          break;
        case MediaPlayerState.READY:
          totalBitratesAvailable();
          if (_playQueue)
          {
            onVideoPlay(event);
          }
          break;
        case MediaPlayerState.UNINITIALIZED:
          break;
      }
    }
    
    /**
     * Sends the ENDED event to the controller, which indicates that the playback is completed.
     * @private
     * @method HDSPlayer#onPlayComplete
     * @param {TimeEvent} event
     */
    private function onPlayComplete(event:TimeEvent):void
    {
      _playheadTimer.stop();
      _resource = null;
      dispatchEvent(new DynamicEvent(DynamicEvent.ENDED,null));
    }
    
    /**
     * Sends the ERROR event to the controller, which indicates the playback error.
     * @private
     * @method HDSPlayer#onMediaError
     * @param {MediaErrorEvent} event
     */
    private function onMediaError(event:MediaErrorEvent):void
    {
      var eventObject:Object = new Object();
      switch(event.error["errorID"])
      {
        case MediaErrorCodes.HTTP_GET_FAILED:
        case MediaErrorCodes.NETCONNECTION_APPLICATION_INVALID:
        case MediaErrorCodes.NETCONNECTION_FAILED:
        case MediaErrorCodes.NETCONNECTION_REJECTED:
        case MediaErrorCodes.NETCONNECTION_TIMEOUT:
        case MediaErrorCodes.SECURITY_ERROR:
          eventObject.errorCode = 2;
          break;
        case MediaErrorCodes.NETSTREAM_STREAM_NOT_FOUND:
        case MediaErrorCodes.MEDIA_LOAD_FAILED:
          eventObject.errorCode = 4;
          break;
        case MediaErrorCodes.ARGUMENT_ERROR:
        case MediaErrorCodes.ASYNC_ERROR:
        case MediaErrorCodes.DRM_SYSTEM_UPDATE_ERROR:
        case MediaErrorCodes.DVRCAST_CONTENT_OFFLINE:
        case MediaErrorCodes.DVRCAST_STREAM_INFO_RETRIEVAL_FAILED:
        case MediaErrorCodes.DVRCAST_SUBSCRIBE_FAILED:
        case MediaErrorCodes.PLUGIN_IMPLEMENTATION_INVALID:
        case MediaErrorCodes.PLUGIN_VERSION_INVALID:
          eventObject.errorCode = -1;
          break;
        case MediaErrorCodes.F4M_FILE_INVALID:
        case MediaErrorCodes.NETSTREAM_FILE_STRUCTURE_INVALID:
        case MediaErrorCodes.NETSTREAM_PLAY_FAILED:
        case MediaErrorCodes.SOUND_PLAY_FAILED:
          eventObject.errorCode = 3;
          break;
        case MediaErrorCodes.NETSTREAM_NO_SUPPORTED_TRACK_FOUND:
          eventObject.errorCode = 0;
          break;
        default:
          eventObject.errorCode = -1;  
          break;
      }
      SendToDebugger("Error: " + event.error["errorID"], " "+event.error.detail);
      dispatchEvent(new DynamicEvent(DynamicEvent.ERROR,(eventObject)));
      unregisterListeners();
    }
    
    /**
     * Sends the SEEKED event to the controller, after seeking is completed successfully.
     * @protected
     * @method HDSPlayer#onSeekingChange
     * @param {SeekEvent} event
     */
    protected function onSeekingChange(event:SeekEvent):void
    {
      if (event.seeking == false)
      {
        _seekTrait.removeEventListener(SeekEvent.SEEKING_CHANGE, onSeekingChange);
        _seekTrait = null;
        if (event.time == _initialTimeReference)
        {
          _playheadTimer.start();
        }
        else
        {
          dispatchEvent(new DynamicEvent(DynamicEvent.SEEKED,null));
        }
      }
    }
    
    /**
     * Initiates the play functionality through the plugin.
     * @public
     * @method HDSPlayer#onVideoPlay
     * @param {Event} event The event passed from the external interface.
     */
    public function onVideoPlay(event:Event):void
    {
      var eventObject:Object = new Object();
      eventObject.url = _videoUrl;
      dispatchEvent(new DynamicEvent(DynamicEvent.PLAY,eventObject));
      
      //Disables the playQueue whenever new play request comes, to avoid unwanted auto play. 
      _playQueue = false;

      //Included MediaPlayerState.BUFFERING in the condition to handle the play requests that occurs
      //when the player is in buffering state.
      
      if (_playerState == MediaPlayerState.READY || _playerState == MediaPlayerState.PAUSED 
          || _playerState == MediaPlayerState.BUFFERING)
      {
        _mediaPlayerSprite.mediaPlayer.play();
      }
      else
      {
        _playQueue = true;
      }
    }
    
    /**
     * Initiates the pause functionality through the plugin.
     * @public
     * @method HDSPlayer#onVideoPause
     * @param {Event} event The event passed from the external interface.
     */
    public function onVideoPause(event:Event):void
    {
      if (_mediaPlayerSprite.mediaPlayer.canPause)
      {
        _playheadTimer.stop();
        _mediaPlayerSprite.mediaPlayer.pause();
      }
      else
      {
        SendToDebugger("Error in pausing video: Player State: ", "onVideoPause");
      }
    }
    
    /**
     * Initiates the seek functionality through the plugin.
     * @public
     * @method HDSPlayer#onVideoSeek
     * @param {Event} event The event passed from the external interface.
     */
    public function onVideoSeek(event:DynamicEvent):void
    {
      //Seeks the video to the specified position. Also check for the ability to seek to avoid error situations.
      var time:Number = (Number)(event.args);
      _initialTimeReference = -1;
      if (_initialPlay) 
      {
        _initialTime = time;
        return;
      }
      _seekTrait = _mediaPlayerSprite.mediaPlayer.media.getTrait(MediaTraitType.SEEK) as SeekTrait;
      if (_mediaPlayerSprite.mediaPlayer.canSeek &&
        (_mediaPlayerSprite.mediaPlayer.canSeekTo(time)))
      {
        _seekTrait.addEventListener(SeekEvent.SEEKING_CHANGE, onSeekingChange);
        _mediaPlayerSprite.mediaPlayer.seek(time);
        SendToDebugger("Seek to: " + time, "onVideoSeek");
      }
      else
      {
        SendToDebugger("Error:Failed to seek to: " + time, "onVideoSeek");
      }
    }
    
    /**
     * Sets the volume of the player, through plugin, to the specified value.
     * @public
     * @method HDSPlayer#onChangeVolume
     * @param {Event} event The event passed from the external interface.
     */
    public function onChangeVolume(event:DynamicEvent):void
    {
      var volume:Number = (Number)(event.args);
      _mediaPlayerSprite.mediaPlayer.volume = volume;
      //Dispatches the VOLUME_CHANGED event only when the change occures properly.
      if (_mediaPlayerSprite.mediaPlayer.volume == volume)
      {
        var eventObject:Object = new Object();
        eventObject.volume = _mediaPlayerSprite.mediaPlayer.volume;
        dispatchEvent(new DynamicEvent(DynamicEvent.VOLUME_CHANGED,(eventObject)));
      }
      else
      {
        SendToDebugger("Error in changing volume: " + _mediaPlayerSprite.mediaPlayer.volume,"onChangeVolume");
        return;
      }
      SendToDebugger("Set Volume to: " + volume, "onChangeVolume");
    }
    
    /**
     * Sets the url of the video.
     * @public
     * @method HDSPlayer#setVideoUrl
     * @param {Event} event The event passed from the external interface.
     */
    public function onSetVideoURL(event:DynamicEvent):void
    {
      _videoUrl = (String)(event.args);
      SendToDebugger("Set Video URL: " + _videoUrl, "onSetVideoURL");
    }
    
    /**
     * Calls function which takes video URL as parameter to load the video.
     * @public
     * @method HDSPlayer#onLoadVideo
     * @param {Event} event The event passed from the external interface.
     */
    public function onLoadVideo(event:DynamicEvent):void
    {
      loadMediaSource(_videoUrl);
      _mediaPlayerSprite.mediaPlayer.autoPlay = false;
    }
    
    /**
     * Sets the closed captions for the video playback
     * @public
     * @method HDSPlayer#onSetVideoClosedCaptions
     * @param {Event} event The event passed from the external interface.
     */
    public function onSetVideoClosedCaptions(event:DynamicEvent):void
    {
      var captionsObject:Object =(Object)(event.args);
      var closedCaptions:Object = captionsObject.closedCaptions;
      var params:Object = captionsObject.params;
      _mode = params.mode;
      _previousCaptionMode = _mode;
      _selectedCaptionLanguage = captionsObject.language;
      
      if (closedCaptions.closed_captions_dfxp != null)
      {
        _captionsURL = closedCaptions.closed_captions_dfxp.url;
      }
      
      if (_captionsURL != "undefined")
      {
        _defaultCaptionFormat = new TextFormat();
        _defaultCaptionFormat.color = 0xffffff;
        _defaultCaptionFormat.size = 14;
        _defaultCaptionFormat.font = "_sans";
        _defaultCaptionFormat.align = "center";
        _captionLabel.defaultTextFormat = _defaultCaptionFormat;
        _mediaPlayerSprite.addChild(_captionLabel);
        _captioningEnabled = true;
        _mode = params.mode;
      }

      SendToDebugger("Set Video Closed Captions :" + _selectedCaptionLanguage +", "+ closedCaptions + ", " +params, "onSetVideoClosedCaptions");

      if (!_captionFlag)
      {
        loadCaptionsUrl(_captionsURL);
        _captionFlag = true;
      }
    }
    
    /**
     * Sets the area available for the caption to render itself, and will set the scaleX/Y
     * values of the text field to captionScaleFactor.
     * @public
     * @method HDSPlayer#setCaptionArea
     * @param {Number} captionMaxWidth Maximum width the captions can cover.
     * @param {Number} captionMaxHeight Maximum height the captions can cover.
     * @param {Number} playerHeight Height of the player.
     * @param {Number} captionScaleFactor Caption scale based on current/base video height ratio.
     */
    public function setCaptionArea(captionMaxWidth:Number, captionMaxHeight:Number, playerHeight:Number,
                     captionScaleFactor:Number = 1):void
    {
      _captionLabel.scaleX = captionScaleFactor;
      _captionLabel.scaleY = captionScaleFactor;
      _captionRegionWidth= captionMaxWidth;
      _captionRegionHeight = captionMaxHeight;
      _captionMaxPlayerHeight = playerHeight;
      adjustCaptionTextPosition();
    }
    
    /**
     * Adjusts the height and width of the caption text.
     * @private
     * @method HDSPlayer#adjustCaptionTextPosition
     */
    private function adjustCaptionTextPosition():void
    {
      // We need to set wordWrap to false in order to get the absolute textWidth. Then, we can
      // reset the wordWrap property based on that value.
      _captionLabel.wordWrap = false;
      if (_captionLabel.width > _captionRegionWidth)
      {
        // Since we are scaling the text field in fullscreen, we need to divide the region width
        // by the scale factor when resetting the width. The width is actually multiplied by the
        // scaling factor when set.
        _captionLabel.wordWrap = true;
        _captionLabel.width = _captionRegionWidth / _captionLabel.scaleX;
      }
      _captionLabel.x = (_captionRegionWidth - _captionLabel.width) / 2;
      var captionTextY:Number = _captionRegionHeight - _captionLabel.height -
        (_captionLabel.scaleY * Number(_defaultCaptionFormat.size));

      var responsiveStageHeightAdjustment = 25;
      if (stage.stageWidth > 1279) responsiveStageHeightAdjustment = 50;
      else if (stage.stageWidth > 839) responsiveStageHeightAdjustment = 45;
      else if (stage.stageWidth > 559) responsiveStageHeightAdjustment = 40;

      _captionLabel.y = captionTextY - responsiveStageHeightAdjustment;
    }
    
    /**
     * Returns caption scale based on current/base video height ratio.
     * @private
     * @method HDSPlayer#captionScaleFactor
     */
    private function get captionScaleFactor():Number
    {
      if (stage.stageWidth == 0 || stage.stageHeight <= BASE_SCALE_FACTOR_HEIGHT) { return BASE_SCALE_FACTOR; }
      
      // Change caption scale based on current/base video height ratio
      // it's possible for the video rectangle not to exist, so we'll just
      // use a scale of 1 in the meantime.
      return BASE_SCALE_FACTOR * (stage.stageHeight/BASE_SCALE_FACTOR_HEIGHT);
    }
    
    /**
     * Adds the caption metadata to the resource.
     * @public
     * @method HDSPlayer#loadCaptionsUrl
     * @param {String} url Captions Url.
     */
    public function loadCaptionsUrl(url:String):void
    {
      var metadata:Metadata = new Metadata();
      metadata.addValue(CaptioningPluginInfo.CAPTIONING_METADATA_KEY_URI,url);
      if (_resource != null)
      {
        _resource.addMetadataValue(CaptioningPluginInfo.CAPTIONING_METADATA_NAMESPACE, metadata);
        _element = _mediaFactory.createMediaElement(_resource);
        _mediaPlayerSprite.media = _element;
      }
      else
      {
        loadMediaSource(_videoUrl);
        loadCaptionsUrl(_captionsURL);
      }  
    }
    
    /**
     * Retrives the caption object.
     * @public
     * @method HDSPlayer#onCaptionready
     * @param {MediaElementEvent} event The event that is raised once the captions are ready.
     */
    private function onCaptionready(event:Event):void
    {
      _captionObject= CaptioningDocument._captionsArray; 
    }
    
    /**
     * Displays the captions on the video screen.
     * @public
     * @method HDSPlayer#onShowCaption
     * @param {int} selectedId Id of the caption to be displayed .
     */
    public function onShowCaption(caption:Caption):void
    {
      _captionLabel.background = true;
      _captionLabel.backgroundColor = 0x000000;
      _captionLabel.opaqueBackground = 0.5;

      if (_captioningEnabled && caption != null)
      {
        _captionLabel.htmlText = caption.text;
        if (caption.text != _previousCaption)
        {
          _captionLabel.autoSize = TextFieldAutoSize.CENTER;
          setCaptionArea(stage.stageWidth, stage.stageHeight, stage.stageHeight, this.captionScaleFactor);
          _previousCaption = caption.text;
        }
      }
    }
    
    /**
     * Sets the closed captions mode
     * @public
     * @method HDSPlayer#onSetVideoClosedCaptionsMode
     * @param {Event} event The event passed from the external interface.
     */
    public function onSetVideoClosedCaptionsMode(event:DynamicEvent):void
    {
      _mode = (String)(event.args);
      _captioningEnabled = false;
      if(_mode == "disabled" && _previousCaptionMode == "hidden")
      {
        _captionLabel.visible = false;
        var eventObject:Object = new Object();
        eventObject.text = "" ;
        dispatchEvent(new DynamicEvent(DynamicEvent.CLOSED_CAPTION_CUE_CHANGED,(eventObject)));
      }
      else if(_mode == "disabled" && _previousCaptionMode == "showing")
      {
        _captionLabel.visible = false;
      }      
      SendToDebugger("Set Video Closed Captions Mode :" + _mode, "onSetVideoClosedCaptionsMode");
    }
    
    /**
     * As the video plays, this method updates the duration,current time and
     * also the buffer length of the video.
     * @public
     * @method HDSPlayer#onPlayheadUpdate
     * @param {Event} event The event passed from the external interface.
     */
    public function onPlayheadUpdate(event:Event):void
    {
      var eventObject:Object = new Object();
      var seekRange:Object = new Object();
      var duration:Number = _mediaPlayerSprite.mediaPlayer.duration;
      var totalTime :Number = 0;
      
      if (_captionFlag)
      {
        selectCaptionObject();
      }
      
      if (_mediaPlayerSprite.mediaPlayer.canSeek && (_mediaPlayerSprite.mediaPlayer.canSeekTo(duration)))
      {
        totalTime = duration;
      }
      else
      {
        totalTime = 0;
      }
      eventObject.currentTime = _mediaPlayerSprite.mediaPlayer.currentTime;
      eventObject.duration = duration
      eventObject.buffer = _mediaPlayerSprite.mediaPlayer.bufferLength + _mediaPlayerSprite.mediaPlayer.currentTime;
      eventObject.seekRange_start = 0;
      eventObject.seekRange_end = totalTime;
      dispatchEvent(new DynamicEvent(DynamicEvent.TIME_UPDATE,(eventObject)));
    }

    /**
     * Selects the appropriate caption object.
     * @public
     * @method HDSPlayer#selectCaptionObject
     */
    public function selectCaptionObject():void
    {
      var captionFlag:Boolean = false;
      if (_captionObject != null && _mode == "showing")
      {
        for each(var captionObject:Caption in _captionObject[_selectedCaptionLanguage])
        {
          var caption:Caption = captionObject;
          if(caption.end > _mediaPlayerSprite.mediaPlayer.currentTime && caption.start <= _mediaPlayerSprite.mediaPlayer.currentTime)
          {
            _captionLabel.visible = true;
            onShowCaption(caption);
            captionFlag = true;
            break;
          }
        }
      }
      else if(_captionObject != null && _mode == "hidden")
      {
        for each(var captionObject:Caption in _captionObject[_selectedCaptionLanguage])
        {  
          _hiddenCaptionFlag =false;  
          var eventObject:Object = new Object();
          var caption:Caption = captionObject;
          if(caption.end > _mediaPlayerSprite.mediaPlayer.currentTime && caption.start <= _mediaPlayerSprite.mediaPlayer.currentTime)
          { 
            _hiddenCaptionFlag =true;  
            if ( (caption.text != _previousCaption) || (_captioningEnabled && (caption.text == _previousCaption) ) )
            {
              var removeHtmlRegExp:RegExp = new RegExp("<[^<]+?>", "gi");
              var ccText = (caption.text).replace(removeHtmlRegExp, "");
              eventObject.text = ccText;
              dispatchEvent(new DynamicEvent(DynamicEvent.CLOSED_CAPTION_CUE_CHANGED,(eventObject)));
              _previousCaption = caption.text;
              _captioningEnabled = false;
            }
            captionFlag = false;
            break;
          }
        }
        if(!_hiddenCaptionFlag &&  _previousCaption != "" )
        {
          eventObject.text = "" ;
          _previousCaption = "" ;
          dispatchEvent(new DynamicEvent(DynamicEvent.CLOSED_CAPTION_CUE_CHANGED,(eventObject)));
          _hiddenCaptionFlag = false;
        }
      }
      if (!captionFlag)
      {
        _captionLabel.visible = false;
      }
    }
    
    /**
     * Starts playing the video from the beginning.
     * @public
     * @method HDSPlayer#onReplay
     * @param {Event} event The event passed from the external interface.
     */
    public function onReplay(event:Event):void
    {
      if (_mediaPlayerSprite.mediaPlayer.state == "playing")
      {
        _mediaPlayerSprite.mediaPlayer.seek(0);
      }
      else if (_mediaPlayerSprite.mediaPlayer.state == "paused")
      {
        _mediaPlayerSprite.mediaPlayer.seek(0);
        _mediaPlayerSprite.mediaPlayer.play();
      }
      else if (_mediaPlayerSprite.mediaPlayer.state == "ready")
      {
        _mediaPlayerSprite.mediaPlayer.play();
      }
    }
    
    /**
     * Sets the initial time from where the video should begin the play.
     * @public
     * @method HDSPlayer#onSetInitialTime
     * @param {Event} event The event passed from the external interface.
     */
    public function onSetInitialTime(event:DynamicEvent):void
    {
      var time:Number = (Number)(event.args);
      if (_mediaPlayerSprite.mediaPlayer.canSeekTo(time))
      {
        _initialTime = time;
      }
      else
        SendToDebugger("Error : Improper value of initial time: " + time , "onSetInitialTime");
    }
    
    /**
     * Returns the current time of the video.
     * @public
     * @method HDSPlayer#onGetCurrentTime
     * @param {Event} event The event passed from the external interface.
     */
    public function onGetCurrentTime(event:Event):void
    {
      var eventObject:Object = new Object();
      eventObject.currentTime = _mediaPlayerSprite.mediaPlayer.currentTime.toString();
      dispatchEvent(new DynamicEvent(DynamicEvent.CURRENT_TIME,(eventObject)));
    }
    
    /**
     * Handler for TimerEvent
     * @public
     * @method HDSPlayer#onPlayheadTimeChanged
     * @param {Event} event Timer event.
     */
    public function onPlayheadTimeChanged(event:TimerEvent = null):void
    {
      // if (!_mediaPlayerSprite.mediaPlayer.seeking) { dispatchPlayheadEvent(this.playheadTime); }
    }
    
    /**
     * Loads the video by creating media element for the player.
     * @private
     * @method HDSPlayer#loadMediaSource
     * @param {Event} event The event passed from the external interface.
     */
    private function loadMediaSource(sourceURL : String):void
    {
      if (_resource == null)
      {
        SendToDebugger(sourceURL ,"loadMediaSource");
        
        _resource = new StreamingURLResource(sourceURL);
        _element = _mediaFactory.createMediaElement( _resource );
        
        stage.scaleMode = StageScaleMode.NO_SCALE;
        _mediaPlayerSprite.scaleMode = ScaleMode.LETTERBOX;
        _mediaPlayerSprite.width = stage.stageWidth;
        _mediaPlayerSprite.height = stage.stageHeight;
        stage.align = StageAlign.TOP_LEFT;

        // Add the media element
        _mediaPlayerSprite.media = _element;
        SendToDebugger("element " + _element, "loadMediaSource");
        SendToDebugger("loadMediaSource LOADED", "loadMediaSource");    
      }
    }
    
    /**
     * Provides the total available bitrates and dispatches BITRATES_AVAILABLE event.
     * @public
     * @method HDSPlayer#totalBitratesAvailable
     */
    public function  totalBitratesAvailable():void
    { 
      if (_bitrateIdArray.length > 0 ) return;
      var eventObject:Object = new Object();
      var id:String;
      if (getStreamsCount() > 0)
      {
        for (var i:int = 0; i < getStreamsCount(); i++)
        {
          _bitrateIdArray.push((_mediaPlayerSprite.mediaPlayer.getBitrateForDynamicStreamIndex(i)) + "kbps");
          id = _bitrateIdArray[i];
          var bitrateObject:Object = new Object();
          bitrateObject.id = id;
          bitrateObject.height = 0;
          bitrateObject.width = 0;
          bitrateObject.bitrate = _mediaPlayerSprite.mediaPlayer.getBitrateForDynamicStreamIndex(i) * 1000;
          _bitrateArray[id] = [ bitrateObject, i];
          eventObject[i] = bitrateObject;
        }
        dispatchEvent(new DynamicEvent(DynamicEvent.BITRATES_AVAILABLE,(eventObject)));
      }
    }

    /**
     * Sets the bitrate and dispatches BITRATE_CHANGED event.
     * @public
     * @method HDSPlayer#onSetTargetBitrate
     * @param {DynamicEvent} event The event passed from the external interface.
     */
    public function onSetTargetBitrate(event:DynamicEvent):void
    { 
      var eventObject:Object = new Object();
      var bitrateId:String= (String)(event.args);
      try
      {
       if (bitrateId != "auto")
       {
         _mediaPlayerSprite.mediaPlayer.autoDynamicStreamSwitch = false;
         _mediaPlayerSprite.mediaPlayer.maxAllowedDynamicStreamIndex =  _mediaPlayerSprite.mediaPlayer.numDynamicStreams - 1;
         //Switches to the stream with the index of bitrate (bitrate of selected bitrate ID)
         _mediaPlayerSprite.mediaPlayer.switchDynamicStreamIndex(_bitrateArray[bitrateId][1]);
       }
       else 
       {
          _mediaPlayerSprite.mediaPlayer.autoDynamicStreamSwitch = true;
      
           eventObject.id = "auto";
           eventObject.height = 0;
           eventObject.width = 0;
           eventObject.bitrate = 0;
           dispatchEvent(new DynamicEvent(DynamicEvent.BITRATE_CHANGED,(eventObject)));
       }
      }
      catch(error:Error)
      {
        SendToDebugger("onSetTargetBitrate Error :"+error.errorID,"onSetTargetBitrate");
      }
    }

    /**
     * Dispatches BITRATE_CHANGED event
     * @public
     * @method HDSPlayer#onBitrateChanged
     * @param {DynamicStreamEvent} event The event dispatched when the properties of a DynamicStreamTrait change.
     */
    private function onBitrateChanged(event:DynamicStreamEvent):void
    {
      var eventObject:Object = new Object();
      var id:String;
    
      if (!event.switching)
      {
        var bitrateIndex:int = _mediaPlayerSprite.mediaPlayer.currentDynamicStreamIndex;
        var newBitrate:Number = _mediaPlayerSprite.mediaPlayer.getBitrateForDynamicStreamIndex(bitrateIndex);

        if (newBitrate != 0 && _currentBitrate != newBitrate)
        {
          for (var i:int = 0; i < _bitrateIdArray.length; i++)
          {
            id = _bitrateIdArray[i];
            if (newBitrate == (_bitrateArray[id][0].bitrate)/1000)
            {
              dispatchEvent(new DynamicEvent(DynamicEvent.BITRATE_CHANGED,(_bitrateArray[id][0])));
              _currentBitrate = newBitrate;
              break;
            }
          }
        }
      }
    }
    
    /**
     * Returns the total number of streams
     * @private
     * @method HDSPlayer#getStreamsCount
     */
    private function getStreamsCount():int
    {
      return _mediaPlayerSprite.mediaPlayer.numDynamicStreams;
    } 
    
    /**
     * Unregisters events and removes media player child.
     * @public
     * @method HDSPlayer#onDestroy
     */
    public function onDestroy():void
    {
      unregisterListeners();
      removeChild(_mediaPlayerSprite); 
    }

    /**
     * Sets the player height and width according to the stage's dimensions on resize.
     * @private
     * @method HDSPlayer#resizeListener
     * @param {Event} event The event dispatched on player resize
     */
    private function resizeListener (event:Event):void
    {
      _mediaPlayerSprite.width = stage.stageWidth;
      _mediaPlayerSprite.height = stage.stageHeight;

      if (_mode == "showing")
      {
        _captionLabel.autoSize = TextFieldAutoSize.CENTER;
        setCaptionArea(stage.stageWidth, stage.stageHeight, stage.stageHeight, this.captionScaleFactor);
      }

      var sizeObject:Object = new Object();
      sizeObject.height = _mediaPlayerSprite.height;
      sizeObject.width = _mediaPlayerSprite.width;
      dispatchEvent(new DynamicEvent(DynamicEvent.SIZE_CHANGED,(sizeObject)));
    }
    
    /*public function onRateChanged(event:Event):void
    {
    }
    
    public function onStalled(event:Event):void
    {
    }
    
    public function onProgress(event:Event):void
    {
    }
    
    public function onVideoEnd(event:Event):void
    {
    }
    
    public function onErrorCode(event:Event):void
    {
    }
    
    public function onDurationChanged(event:Event):void
    {
    }
    
    public function onWaiting(event:Event):void
    {
    }
    
    public function onCanPlayThrough(event:Event):void
    {
    }
    
    public function onPlaying(event:Event):void
    {
    }
    
    public function onSeeking(event:Event):void
    {
    }
    
    public function onTelstraSucceed(event:Event):void
    {  
    }
    
    public function onTelstraFailed(event:Event):void
    {
    }*/
  }
}
