package
{
  import DynamicEvent;
  import ExternalJavaScriptAPI;
  import Logger;
  
  import flash.display.Sprite;
  import flash.display.StageDisplayState;
  import flash.display.StageScaleMode;
  import flash.display.StageAlign;
  import flash.events.Event;
  import flash.events.FullScreenEvent;
  import flash.events.MouseEvent;
  import flash.events.TimerEvent;
  import flash.events.NetStatusEvent;
  import flash.external.ExternalInterface;
  import flash.system.Security;
  import flash.text.TextField;
  import flash.text.TextFieldAutoSize;
  import flash.text.TextFormat;
  import flash.utils.Timer;
  import flash.net.URLLoader;
  import flash.net.URLRequest;
  
  import com.akamai.net.f4f.hds.AkamaiBufferProfileType;
  import com.akamai.net.f4f.hds.AkamaiHTTPNetStream;
  import com.akamai.net.f4f.hds.AkamaiStreamController;
  import com.akamai.net.f4f.hds.events.AkamaiHDSEvent;
  import com.akamai.display.AkamaiVideoSurface;

  import org.openvideoplayer.events.OvpEvent;
  import org.osmf.events.MediaPlayerStateChangeEvent;
  import org.osmf.events.BufferEvent;
  import org.osmf.events.DynamicStreamEvent;
  import org.osmf.media.MediaPlayerState;
  import org.osmf.events.MediaErrorCodes;
  import org.osmf.events.MediaErrorEvent;
  import org.osmf.events.TimeEvent;
  import org.osmf.net.NetStreamCodes;
  import org.osmf.net.NetClient;
  
  public class AkamaiHDPlayer extends Sprite
  {
    private var _streamController:AkamaiStreamController;
    private var _netStream:AkamaiHTTPNetStream;
    private var _akamaiVideoSurface:AkamaiVideoSurface;
    private var _akamaiStreamURL:String;
    private var _playheadTimer:Timer = null;

    private var _playQueue:Boolean = false;
    private var _initialPlay:Boolean = true;
    private var _initalSeekTime:Number = 0;
    private var _playerState:String = "";
    private var _bitrateArray:Array=new Array();
    private var _bitrateIdArray:Array = new Array();
    private var _currentBitrate:Number = -1;
    private var _previousBitrate:Number = -1;
    private var _bitrateFlag:Number = 0;

    private var _selectedCaptionLanguage:String = "";
    private var _captionObject:Object = new Object();
    private static const CAPTIONING_PLUGIN_INFO:String = "CaptioningPluginInfo";
    private var _captioningEnabled:Boolean; 
    private var _captionLabel:TextField = new TextField();;
    private var _defaultCaptionFormat:TextFormat;
    private var _captionsURL:String;
    private var _captionFlag:Boolean = false;
    private var _mode:String;
    private var _captionRegionWidth:Number;
    private var _captionRegionHeight:Number;
    private var _captionMaxPlayerHeight:Number;
    private var _previousCaption:String = "";
    private var _previousSelectedCaptionLanguage:String = "";
    private var _selectedCaptionObject:Object = new Object();
    public static const BASE_SCALE_FACTOR_HEIGHT:Number = 400;
    public static const BASE_SCALE_FACTOR:Number = 1;;
    private var _hiddenCaptionFlag:Boolean = false;
    private var _previousCaptionMode:String;
    private var _dfxp:XML = new XML();
    private var _loader:URLLoader;
    private var _captioningDocument:CaptioningDocument;
    private var _akamaiEdgeAuthTokenAuthorizer:AkamaiEdgeAuthTokenAuthorizer;
    private var _pCode:String = "";
    private var _embebCode:String = "";
    private var _secureHDToken:Boolean = false;
    private var _sasServerWithProtocolAndPort:String = "http://player.ooyala.com/sas";
    private var _tokenFetched:Boolean = false;
    private var _playSecurestream:Boolean = false;
    private var _goLiveFlag:Boolean = true;
    private var _liveFlag:Boolean = true;
    private var originalWidth:Number = 0;
    private var originalHeight:Number = 0;
    private var originalAspectRatio:Number = 0;

    /**
     * Constructor
     * @public
     */
    public function AkamaiHDPlayer( )
    {
      Security.allowDomain("*");
      Security.allowInsecureDomain('*')

      var externalJavaScriptApi:ExternalJavaScriptAPI = new ExternalJavaScriptAPI(this);
    }
    
    /**
     * Registers the event listners
     * @public
     * @method AkamaiHDPlayer#registerListeners
     */
    private function registerListeners():void
    {
      _streamController.mediaPlayer.addEventListener(AkamaiHDSEvent.COMPLETE, onPlayComplete);
      _streamController.mediaPlayer.addEventListener(MediaErrorEvent.MEDIA_ERROR, onMediaError);
      _streamController.addEventListener(AkamaiHDSEvent.NETSTREAM_READY, onNetStreamReady); 
      _streamController.mediaPlayer.addEventListener(MediaPlayerStateChangeEvent.MEDIA_PLAYER_STATE_CHANGE,
                                                     onPlayerStateChange);
      _streamController.mediaPlayer.addEventListener(BufferEvent.BUFFERING_CHANGE, bufferingChangeHandler);
      _streamController.mediaPlayer.addEventListener(DynamicStreamEvent.SWITCHING_CHANGE, onBitrateChanged);
      CaptioningDocument.addEventListener(CaptioningDocument.CAPTION_READY, onCaptionready);
      _streamController.addEventListener(AkamaiHDSEvent.IS_PLAYING_LIVE, isLive);
      stage.addEventListener(FullScreenEvent.FULL_SCREEN, resizeListener);
      stage.addEventListener(Event.RESIZE, resizeListener);
      Logger.log("events added", "registerListeners");
    }
    
    /**
     * Unregisters the event listners
     * @public
     * @method AkamaiHDPlayer#unregisterListeners
     */
    private function unregisterListeners():void
    {
      _streamController.mediaPlayer.removeEventListener(AkamaiHDSEvent.COMPLETE, onPlayComplete);
      _streamController.mediaPlayer.removeEventListener(MediaPlayerStateChangeEvent.MEDIA_PLAYER_STATE_CHANGE,
                                                        onPlayerStateChange);
      _streamController.mediaPlayer.removeEventListener(BufferEvent.BUFFERING_CHANGE, bufferingChangeHandler);
      _streamController.mediaPlayer.removeEventListener(DynamicStreamEvent.SWITCHING_CHANGE, onBitrateChanged);
      CaptioningDocument.removeEventListener(CaptioningDocument.CAPTION_READY,onCaptionready);
      _streamController.removeEventListener(AkamaiHDSEvent.IS_PLAYING_LIVE, isLive);
      stage.addEventListener(FullScreenEvent.FULL_SCREEN, resizeListener);
      stage.addEventListener(Event.RESIZE, resizeListener);
      _netStream.removeEventListener(NetStatusEvent.NET_STATUS, onNetStatus);
    }
    
    /**
     * Determines whether content is buffered
     * @public
     * @method AkamaiHDPlayer#unregisterListeners
     */
    private function bufferingChangeHandler(e:BufferEvent):void
    {
      if (!_streamController.mediaPlayer.buffering)
      {
        var eventObject:Object = new Object();
        eventObject.url = _akamaiStreamURL;
        dispatchEvent(new DynamicEvent(DynamicEvent.BUFFERED,eventObject));
      }
    }
    
    /**
     * Creates the MediaPlayerSprite and DefaultMediaFactory instances.
     * @public
     * @method AkamaiHDPlayer#initMediaPlayer
     */
    public function initMediaPlayer():void
    {
      Logger.log("initMediaPlayer()", "initMediaPlayer");
      
      /* Creates a timer to keep track of the TIME_UPDATE event.
      The triggering value can be changed as per the specifications. */
      _playheadTimer = new Timer(250);
      _playheadTimer.addEventListener(TimerEvent.TIMER, onPlayheadUpdate);
      _playheadTimer.reset();
      
      _streamController = new AkamaiStreamController();
      registerListeners();
      configureStreamProperties();

      _akamaiVideoSurface = new AkamaiVideoSurface();
      addChild(_akamaiVideoSurface);
    }

    /**
     * Event listner for AkamaiHDSEvent
     * @private
     * @method AkamaiHDPlayer#onNetStreamReady
     * @param {AkamaiHDSEvent} event
     */
    private function onNetStreamReady(event:AkamaiHDSEvent):void
    {
      Logger.log("onNetStreamReady" , "onNetStreamReady");
      _netStream = _streamController.netStream as AkamaiHTTPNetStream;
      _netStream.addEventListener(NetStatusEvent.NET_STATUS, onNetStatus);
      _akamaiVideoSurface.attachNetStream(_netStream);

      var id:String;
        if(_previousBitrate != -1)
        {
          if(_bitrateFlag != 0)
          {
            for (var i:int = 0; i < _bitrateIdArray.length; i++)
            {
              id = _bitrateIdArray[i];
              if (_previousBitrate == (_bitrateArray[id][0].bitrate)/1000)
              {
                _streamController.mediaPlayer.autoDynamicStreamSwitch = false;
                _streamController.mediaPlayer.switchDynamicStreamIndex(_bitrateArray[id][1]);
              }
            }
          }
          else
          {
            _streamController.mediaPlayer.autoDynamicStreamSwitch = true;
          }
        }

      if (_playQueue)
      {
        _playQueue = false;
        _streamController.resume();
      }
    }

    /**
     * Event handler for AkamaiHDSEvent
     * @private
     * @method AkamaiHDPlayer#isLive
     * @param {Event} event
     */
    private function isLive(event:Event):void
    {
      NetClient(_netStream.client).addHandler(NetStreamCodes.ON_CUE_POINT, onCuePoint);
    }

    /**
     * Event handler for NetStreamCodes Event
     * @private
     * @method AkamaiHDPlayer#onCuePoint
     * @param {Object} info event info object
     */
    private function onCuePoint(info:Object):void
    {
      if(_captionFlag == false)
      {
        dispatchEvent(new DynamicEvent(DynamicEvent.CAPTIONS_FOUND_ON_PLAYING,null));
        _captionFlag = true;
      }
      var eventObject:Object = new Object();
      var caption : Object = info["parameters"];
      for (var key:String in caption)
      {
        if(key.substr(0,4)=="data")
        {
          var captionText : String = caption[key];
          if (captionText != null && _mode !="disabled")
          {
            eventObject.text = captionText;
            dispatchEvent(new DynamicEvent(DynamicEvent.CLOSED_CAPTION_CUE_CHANGED,(eventObject)));
          }
        }  
      }
    }

    /**
     * Event listner for NetStatusEvent
     * @private
     * @method AkamaiHDPlayer#onNetStatus
     * @param {NetStatusEvent} event
     */
    private function onNetStatus(event:NetStatusEvent):void
    {
      if (event.info.code == "NetStream.Buffer.Full")
      {
        if (_initalSeekTime != 0)
        {
          if (_initalSeekTime > _streamController.mediaPlayer.duration)
          {
            _initalSeekTime = (int) (_streamController.mediaPlayer.duration);
            dispatchTimeUpdateEvent(_initalSeekTime); 
          }
          else if (_initalSeekTime < 0)
          {
            return;
          }
          if (_streamController.mediaPlayer.canSeek &&
              (_streamController.mediaPlayer.canSeekTo(_initalSeekTime)))
          {
            _streamController.seek(_initalSeekTime);
          }
          _initalSeekTime = 0;
        }
      }
      else if (event.info.code == "NetStream.Seek.Notify")
      {
        if(_initialPlay == false)
        {
          dispatchEvent(new DynamicEvent(DynamicEvent.SEEKED,null));
        }
        else
        {
          _initialPlay = false;
        }
      }
      else if (event.info.code == "NetStream.Seek.Failed")
      {
        Logger.log("Error:Seeking Operation failed", "onNetStatus");
      }
    }

    /**
     * Adds the display object to the streamcontroller.
     * @private
     * @method AkamaiHDPlayer#configureStreamProperties
     */
    private function configureStreamProperties():void
    {
      _streamController.displayObject = this;
    }
    
    /**
     * Event listner for MediaPlayerStateChangeEvent
     * @private
     * @method AkamaiHDPlayer#onPlayerStateChange
     * @param {MediaPlayerStateChangeEvent} event
     */
    private function onPlayerStateChange(event:MediaPlayerStateChangeEvent):void
    {
      Logger.log("akamaiHD state changed: " + event.state, "onPlayerStateChange");
      _playerState = event.state;
      
      switch(event.state)
      {
        case MediaPlayerState.PLAYING:
          if (_playheadTimer.running == false)
          {
            _playheadTimer.start();
          }
          dispatchEvent(new DynamicEvent(DynamicEvent.PLAYING,null));
          break;
        case MediaPlayerState.PAUSED:
          dispatchEvent(new DynamicEvent(DynamicEvent.PAUSED,null));
          break;
        case MediaPlayerState.BUFFERING:
          var eventObject:Object = new Object();
          eventObject.url = _akamaiStreamURL;
          dispatchEvent(new DynamicEvent(DynamicEvent.BUFFERING,eventObject));
          break;
        case MediaPlayerState.PLAYBACK_ERROR:
          break;
        case MediaPlayerState.LOADING:
          break;
        case MediaPlayerState.READY:
          raiseTotalBitratesAvailable();
          break;
        case MediaPlayerState.UNINITIALIZED:
          break;
      }
    }
    
    /**
     * Sends the ENDED event to the controller, which indicates that the playback is completed.
     * @private
     * @method AkamaiHDPlayer#onPlayComplete
     * @param {TimeEvent} event
     */
    private function onPlayComplete(event:TimeEvent):void
    {
      _playheadTimer.stop();
      _previousBitrate = _currentBitrate;
      dispatchEvent(new DynamicEvent(DynamicEvent.ENDED,null));
    }
    
    /**
     * Sends the ERROR event to the controller, which indicates the playback error.
     * @private
     * @method AkamaiHDPlayer#onMediaError
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
      Logger.log("Error: " + event.error["errorID"], " " + event.error.detail);
      dispatchEvent(new DynamicEvent(DynamicEvent.ERROR,(eventObject)));
      unregisterListeners();
    }
    
    /**
     * Initiates the play functionality through the plugin.
     * @public
     * @method AkamaiHDPlayer#onVideoPlay
     * @param {Event} event The event passed from the external interface.
     */
    public function onVideoPlay(event:Event):void
    {
      var eventObject:Object = new Object();
      eventObject.url = _akamaiStreamURL;
      dispatchEvent(new DynamicEvent(DynamicEvent.PLAY,eventObject));
      
      //Disables the playQueue whenever new play request comes, to avoid unwanted auto play. 
      _playQueue = false;

      if ( _streamController.netStream == null || _playerState == MediaPlayerState.READY 
                                            || _playerState == MediaPlayerState.BUFFERING)
      {
        _playQueue = true;
        if(!_secureHDToken || (_secureHDToken && _tokenFetched))
        {
          _streamController.play(_akamaiStreamURL);
        }
        else
        {
          _playSecurestream = true;
        }
      }
      else
      {
        _streamController.resume();
      }
    }
    
    /**
     * Initiates the pause functionality through the plugin.
     * @public
     * @method AkamaiHDPlayer#onVideoPause
     * @param {Event} event The event passed from the external interface.
     */
    public function onVideoPause(event:Event):void
    {
      if (_streamController.canPause)
      {
        _playheadTimer.stop();
        _streamController.pause();
      }
      else
      {
        Logger.log("Error in pausing video: Player State: ", "onVideoPause");
      }
    }
    
    /**
     * Initiates the seek functionality through the plugin.
     * @public
     * @method AkamaiHDPlayer#onVideoSeek
     * @param {Event} event The event passed from the external interface.
     */
    public function onVideoSeek(event:DynamicEvent):void
    {
      if(_liveFlag == true)
      {
        _goLiveFlag = true;
        _liveFlag = false;
      }
      else
      {
        _goLiveFlag = false;
      }
      var time:Number = (Number)(event.args);

      if (_initialPlay) 
      {
        _initalSeekTime = time;
        return;
      }

      if (_streamController.mediaPlayer.canSeek &&
        (_streamController.mediaPlayer.canSeekTo(time)))
      {
        _streamController.seek(time);
        dispatchTimeUpdateEvent(time);
        Logger.log("Seek to: " + time, "onVideoSeek");
      }
      else
      {
        Logger.log("Error:Cannot seek to : " + time, "onVideoSeek");
      }
    }
    
    /**
     * Sets the volume of the player, through plugin, to the specified value.
     * @public
     * @method AkamaiHDPlayer#onChangeVolume
     * @param {Event} event The event passed from the external interface.
     */
    public function onChangeVolume(event:DynamicEvent):void
    {
      var volume:Number = (Number)(event.args);
      _streamController.volume = volume;
      //Dispatches the VOLUME_CHANGED event only when the change occures properly.
      if (_streamController.volume == volume)
      {
        var eventObject:Object = new Object();
        eventObject.volume = _streamController.volume;
        dispatchEvent(new DynamicEvent(DynamicEvent.VOLUME_CHANGED,(eventObject)));
      }
      else
      {
        Logger.log("Error in changing volume: " +_streamController.volume,"onChangeVolume");
        return;
      }
      Logger.log("Set Volume to: " + volume, "onChangeVolume");
    }
    
    /**
     * Sets the url of the video.
     * @public
     * @method AkamaiHDPlayer#setVideoUrl
     * @param {Event} event The event passed from the external interface.
     */
    public function onSetVideoURL(event:DynamicEvent):void
    {
      _akamaiStreamURL = (String)(event.args);
    }
    
    /**
     * Sets the embebCode, pcode, and whether its a secure stream for the secureHD stream.
     * @public
     * @method AkamaiHDPlayer#setSecureContent
     * @param {Event} event The event passed from the external interface.
     */
    public function setSecureContent(event:DynamicEvent):void
    {
      _embebCode =event.args.assetId;
      _pCode = event.args.accountId;
      _secureHDToken = event.args.secureContent;
      // implementation for secureHD stream for appending the secure token to the stream.
      if(_secureHDToken)
      {
        _akamaiEdgeAuthTokenAuthorizer =  new AkamaiEdgeAuthTokenAuthorizer(_sasServerWithProtocolAndPort);
        _akamaiEdgeAuthTokenAuthorizer.addEventListener(AkamaiEdgeAuthTokenAuthorizer.AUTH_COMPLETE,
          onEdgeTokenComplete);
        _akamaiEdgeAuthTokenAuthorizer.fetchEdgeAuthToken(_embebCode, _pCode);
      }
    }

    /**
     * Notifies the live button click.
     * @public
     * @method AkamaiHDPlayer#onLiveClick
     * @param {Event} event The event passed from the external interface.
     */
    public function onLiveClick(event:DynamicEvent):void
    {
      _liveFlag = true;
    }

    /**
     * Event listner for AkamaiEdgeAuthTokenAuthorizer.AUTH_COMPLETE which is used to append the token
     * to the akamai stream url.
     * @private
     * @method AkamaiHDPlayer#onEdgeTokenComplete
     * @param {Event} event
     */
    private function onEdgeTokenComplete(event:Event):void
    {  
      var delimiter:String = _akamaiStreamURL.indexOf("?") < 0 ? "?" : "&";
      _akamaiStreamURL =_akamaiStreamURL + delimiter + "hdnea=" +
      _akamaiEdgeAuthTokenAuthorizer.EdgeAuthToken;
      _akamaiEdgeAuthTokenAuthorizer.removeEventListener(AkamaiEdgeAuthTokenAuthorizer.AUTH_COMPLETE,
        onEdgeTokenComplete);
      _tokenFetched = true;
      if(_playSecurestream)
      {
        _streamController.play(_akamaiStreamURL);
      }
    }
    
    /**
     * Calls function which takes video URL as parameter to load the video.
     * @public
     * @method AkamaiHDPlayer#onLoadVideo
     * @param {Event} event The event passed from the external interface.
     */
    public function onLoadVideo(event:DynamicEvent):void
    {
      originalAspectRatio = (Number)(event.args);
      if (stage.stageWidth >= stage.stageHeight)
      {
        _akamaiVideoSurface.width = stage.stageWidth;
        _akamaiVideoSurface.height = stage.stageWidth * originalAspectRatio;      
      } else {
        _akamaiVideoSurface.height = stage.stageHeight;
        _akamaiVideoSurface.height = stage.stageHeight * originalAspectRatio;
      }

      stage.scaleMode = StageScaleMode.NO_SCALE;
      stage.align = StageAlign.TOP_LEFT;

      _streamController.mediaPlayer.autoPlay = false;
    }
    
    /**
     * Sets the closed captions for the video playback
     * @public
     * @method AkamaiHDPlayer#onSetVideoClosedCaptions
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
        _akamaiVideoSurface.addChild(_captionLabel);
        _captioningEnabled = true;
        _mode = params.mode;
      }

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
     * @method AkamaiHDPlayer#setCaptionArea
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
     * @method AkamaiHDPlayer#adjustCaptionTextPosition
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

      var responsiveStageHeightAdjustment : Number= 25;
      if (stage.stageWidth > 1279) responsiveStageHeightAdjustment = 50;
      else if (stage.stageWidth > 839) responsiveStageHeightAdjustment = 45;
      else if (stage.stageWidth > 559) responsiveStageHeightAdjustment = 40;

      _captionLabel.y = captionTextY - responsiveStageHeightAdjustment;
    }

    /**
     * Returns caption scale based on current/base video height ratio.
     * @private
     * @method AkamaiHDPlayer#captionScaleFactor
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
     * @method AkamaiHDPlayer#loadCaptionsUrl
     * @param {String} url Captions Url.
     */
    public function loadCaptionsUrl(url:String):void
    {
      var urlRequest : URLRequest = new URLRequest(url);
      _loader = new URLLoader(urlRequest);
      _loader.addEventListener(Event.COMPLETE, loaded);
    }

    /**
     * Adds the caption metadata to the resource.
     * @public
     * @method AkamaiHDPlayer#loaded
     * @param {Event} event Event listner for the loader.
     */
    private function loaded(event:Event):void
    {
      _dfxp = XML(_loader.data);

      var parser:ICaptioningParser = new DFXPParser();
      _captioningDocument = parser.parse(_dfxp);
      _captionObject = _captioningDocument._captionsObject;
    }

    /**
     * Retrives the caption object.
     * @public
     * @method AkamaiHDPlayer#onCaptionready
     * @param {MediaElementEvent} event The event that is raised once the captions are ready.
     */
    private function onCaptionready(event:Event):void
    {
      _captionObject= _captioningDocument._captionsObject; 
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
      _captionLabel.visible = true;

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
     * @method AkamaiHDPlayer#onSetVideoClosedCaptionsMode
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
      Logger.log("Set Video Closed Captions Mode :" + _mode, "onSetVideoClosedCaptionsMode");
    }
    
    /**
     * As the video plays, this method updates the duration,current time and
     * also the buffer length of the video.
     * @public
     * @method AkamaiHDPlayer#onPlayheadUpdate
     * @param {Event} event The event passed from the external interface.
     */
    public function onPlayheadUpdate(event:Event):void
    {
      if (!_streamController.mediaPlayer.seeking) 
      { 
        if(_streamController.isLiveStream && _goLiveFlag)
        {
          dispatchTimeUpdateEvent(_streamController.mediaPlayer.duration);
          return;
        }
        dispatchTimeUpdateEvent(_streamController.mediaPlayer.currentTime); 
      }
    }
    
    /**
     * As the video plays, this method updates the duration,current time and
     * also the buffer length of the video.
     * @public
     * @method AkamaiHDPlayer#dispatchTimeUpdateEvent
     * @param {Number} time The value of current playhead time.
     */
    public function dispatchTimeUpdateEvent(time:Number):void
    {
      var eventObject:Object = new Object();
      var seekRange:Object = new Object();
      var duration:Number = _streamController.mediaPlayer.duration;
      var totalTime :Number = 0;
      
      if (_captionFlag)
      {
        selectCaptionObject();
      }
      if (_streamController.mediaPlayer.canSeek && (_streamController.mediaPlayer.canSeekTo(duration)))
      {
        totalTime = duration;
      }
      else
      {
        totalTime = 0;
      }
      eventObject.currentTime = time;
      eventObject.duration = duration;
      eventObject.buffer = _streamController.mediaPlayer.bufferLength + _streamController.mediaPlayer.currentTime;
      eventObject.seekRange_start = 0;
      eventObject.seekRange_end = totalTime;
      dispatchEvent(new DynamicEvent(DynamicEvent.TIME_UPDATE,(eventObject)));
    }

    /**
     * Selects the appropriate caption object.
     * @public
     * @method AkamaiHDPlayer#selectCaptionObject
     */
    public function selectCaptionObject():void
    {
      var captionFlag:Boolean = false;
      if (_captionObject != null && _mode == "showing")
      {
        for each(var captionObject:Caption in _captionObject[_selectedCaptionLanguage])
        {
          var caption:Caption = captionObject;
          if(caption.end > _streamController.mediaPlayer.currentTime && caption.start <= _streamController.mediaPlayer.currentTime)
          {
            _captionLabel.visible = true;
            onShowCaption(caption);
            captionFlag = true;
            break;
          }
        }
      }
      if(_captionObject != null && _mode == "hidden")
      {
        for each(var captionObject:Caption in _captionObject[_selectedCaptionLanguage])
        {  
          _hiddenCaptionFlag =false;  
          var eventObject:Object = new Object();
          var caption:Caption = captionObject;
          if(caption.end > _streamController.mediaPlayer.currentTime && caption.start <= _streamController.mediaPlayer.currentTime)
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
     * Returns the current time of the video.
     * @public
     * @method AkamaiHDPlayer#onGetCurrentTime
     * @param {Event} event The event passed from the external interface.
     */
    public function onGetCurrentTime(event:Event):void
    {
      var eventObject:Object = new Object();
      eventObject.currentTime = _streamController.mediaPlayer.currentTime.toString();
      dispatchEvent(new DynamicEvent(DynamicEvent.CURRENT_TIME,(eventObject)));
    }
    
    /**
     * Handler for TimerEvent
     * @public
     * @method AkamaiHDPlayer#onPlayheadTimeChanged
     * @param {Event} event Timer event.
     */
    public function onPlayheadTimeChanged(event:TimerEvent = null):void
    {
    }

    /**
     * Provides the total available bitrates and dispatches BITRATES_AVAILABLE event.
     * @public
     * @method AkamaiHDPlayer#raiseTotalBitratesAvailable
     */
    public function  raiseTotalBitratesAvailable():void
    {
      if (_bitrateIdArray.length > 0 ) return;
      var eventObject:Object = new Object();
      var id:String;
      if (getStreamsCount() > 0)
      {
        for (var i:int = 0; i < getStreamsCount(); i++)
        {
          _bitrateIdArray.push((_streamController.mediaPlayer.getBitrateForDynamicStreamIndex(i)) + "kbps");
          id = _bitrateIdArray[i];
          var bitrateObject:Object = new Object();
          bitrateObject.id = id;
          bitrateObject.height = 0;
          bitrateObject.width = 0;
          bitrateObject.bitrate = _streamController.mediaPlayer.getBitrateForDynamicStreamIndex(i) * 1000;
          _bitrateArray[id] = [ bitrateObject, i];
          eventObject[i] = bitrateObject;
        }
        dispatchEvent(new DynamicEvent(DynamicEvent.BITRATES_AVAILABLE,(eventObject)));
      } 
    }

    /**
     * Sets the bitrate and dispatches BITRATE_CHANGED event.
     * @public
     * @method AkamaiHDPlayer#onSetTargetBitrate
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
         _streamController.mediaPlayer.autoDynamicStreamSwitch = false;
         _streamController.mediaPlayer.maxAllowedDynamicStreamIndex =  _streamController.mediaPlayer.numDynamicStreams - 1;
         //Switches to the stream with the index of bitrate (bitrate of selected bitrate ID)
         _streamController.mediaPlayer.switchDynamicStreamIndex(_bitrateArray[bitrateId][1]);
         _bitrateFlag = 1;
       }
       else 
       {
         _streamController.mediaPlayer.autoDynamicStreamSwitch = true;

         eventObject.id = "auto";
         eventObject.height = 0;
         eventObject.width = 0;
         eventObject.bitrate = 0;
         dispatchEvent(new DynamicEvent(DynamicEvent.BITRATE_CHANGED,(eventObject)));
         _bitrateFlag = 0;
       }
      }
      catch(error:Error)
      {
        Logger.log("onSetTargetBitrate Error :"+error.errorID,"onSetTargetBitrate");
      } 
    }

    /**
     * Dispatches BITRATE_CHANGED event
     * @public
     * @method AkamaiHDPlayer#onBitrateChanged
     * @param {DynamicStreamEvent} event The event dispatched when the properties of a DynamicStreamTrait change.
     */
    private function onBitrateChanged(event:DynamicStreamEvent):void
    {
      var eventObject:Object = new Object();
      var id:String;
    
      if (!event.switching)
      {
        var bitrateIndex:int = _streamController.mediaPlayer.currentDynamicStreamIndex;
        var newBitrate:Number = _streamController.mediaPlayer.getBitrateForDynamicStreamIndex(bitrateIndex);

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
     * @method AkamaiHDPlayer#getStreamsCount
     */
    private function getStreamsCount():int
    {
      return _streamController.mediaPlayer.numDynamicStreams;
    }

    /**
     * Sets the player height and width according to the stage's dimensions on resize.
     * @private
     * @method AkamaiHDPlayer#resizeListener
     * @param {Event} event The event dispatched on player resize
     */
    private function resizeListener (event:Event):void
    {
      _akamaiVideoSurface.width = stage.stageWidth;
      _akamaiVideoSurface.height = stage.stageWidth * originalAspectRatio;

      if (_mode == "showing")
      {
        _captionLabel.autoSize = TextFieldAutoSize.CENTER;
        setCaptionArea(stage.stageWidth, stage.stageHeight, stage.stageHeight, this.captionScaleFactor);
      }

      var sizeObject:Object = new Object();
      sizeObject.height = _akamaiVideoSurface.height;
      sizeObject.width = _akamaiVideoSurface.width;
      dispatchEvent(new DynamicEvent(DynamicEvent.SIZE_CHANGED,(sizeObject)));
    } 
    
    /**
     * Unregisters events and removes media player child.
     * @public
     * @method AkamaiHDPlayer#onDestroy
     */
    public function onDestroy():void
    {
      unregisterListeners();
      removeChild(_akamaiVideoSurface); 
    }
  }
}
