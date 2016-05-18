package
{
  import DynamicEvent;
  import ExternalJavaScriptAPI;
  import Logger;
  
  import flash.display.Sprite;
  import flash.display.StageDisplayState;
  import flash.events.Event;
  import flash.events.MouseEvent;
  import flash.events.TimerEvent;
  import flash.events.NetStatusEvent;
  import flash.external.ExternalInterface;
  import flash.system.Security;
  import flash.utils.Timer;
  
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
  import org.osmf.traits.MediaTraitType;
  import org.osmf.traits.SeekTrait;
  import org.osmf.events.MediaErrorCodes;
  import org.osmf.events.MediaErrorEvent;
  import org.osmf.events.TimeEvent;
  import org.osmf.events.SeekEvent;
  
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
      _streamController.addEventListener(AkamaiHDSEvent.COMPLETE, onPlayComplete);
      _streamController.mediaPlayer.addEventListener(MediaErrorEvent.MEDIA_ERROR, onMediaError);
      _streamController.addEventListener(AkamaiHDSEvent.NETSTREAM_READY, onNetStreamReady); 
      _streamController.mediaPlayer.addEventListener(MediaPlayerStateChangeEvent.MEDIA_PLAYER_STATE_CHANGE,
                                                     onPlayerStateChange);
      _streamController.mediaPlayer.addEventListener(BufferEvent.BUFFERING_CHANGE, bufferingChangeHandler);
      Logger.log("events added", "registerListeners");
    }
    
    /**
     * Unregisters the event listners
     * @public
     * @method AkamaiHDPlayer#unregisterListeners
     */
    private function unregisterListeners():void
    {
      _streamController.removeEventListener(AkamaiHDSEvent.COMPLETE, onPlayComplete);
      _streamController.mediaPlayer.removeEventListener(MediaErrorEvent.MEDIA_ERROR, onMediaError);
      _streamController.mediaPlayer.removeEventListener(MediaPlayerStateChangeEvent.MEDIA_PLAYER_STATE_CHANGE,
                                                        onPlayerStateChange);
      _streamController.mediaPlayer.removeEventListener(BufferEvent.BUFFERING_CHANGE, bufferingChangeHandler);
      _netStream.removeEventListener(NetStatusEvent.NET_STATUS, onNetStatus);
    }
    
    /**
     * Determines whether content is buffered
     * @public
     * @method AkamaiHDPlayer#unregisterListeners
     */
    private function bufferingChangeHandler(e:BufferEvent):void
    {
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
     * @method AkamaiHD3Player#onNetStreamReady
     * @param {AkamaiHDSEvent} event
     */
    private function onNetStreamReady(event:AkamaiHDSEvent):void
    {
      Logger.log("onNetStreamReady" , "onNetStreamReady");
      _netStream = _streamController.netStream as AkamaiHTTPNetStream;
      _netStream.addEventListener(NetStatusEvent.NET_STATUS, onNetStatus);
      _akamaiVideoSurface.attachNetStream(_netStream);
      if (_playQueue)
      {
        _playQueue = false;
        _streamController.resume();
      }
    }
    
    /**
     * Event listner for NetStatusEvent
     * @private
     * @method AkamaiHD3Player#onNetStatus
     * @param {NetStatusEvent} event
     */
    private function onNetStatus(event:NetStatusEvent):void
    {
      if (event.info.code == "NetStream.Buffer.Full")
      {
        if (_initialPlay)
        {
          //Sets initial time to duration when it is greater than duration
          if (_initalSeekTime > _streamController.mediaPlayer.duration)
          {
            _initalSeekTime = (int) (_streamController.mediaPlayer.duration); 
          }
          //Sets initial time to zero when it is less than zero
          else if (_initalSeekTime < 0)
          {
            _initalSeekTime = 0;
          }
        }
        if (_initalSeekTime != 0)
        {
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
     * @method AkamaiHD3Player#configureStreamProperties
     */
    private function configureStreamProperties():void
    {
      _streamController.displayObject = this;
    }
  
    /**
     * Event listner for MediaPlayerStateChangeEvent
     * @private
     * @method AkamaiHD3Player#onPlayerStateChange
     * @param {MediaPlayerStateChangeEvent} event
     */
    private function onPlayerStateChange(event:MediaPlayerStateChangeEvent):void
    {
      Logger.log("akamaiHD state changed: " + event.state, "onPlayerStateChange");
      
      switch(event.state)
      {
        case MediaPlayerState.PLAYING:
          dispatchEvent(new DynamicEvent(DynamicEvent.PLAYING,null));
          break;
        case MediaPlayerState.PAUSED:
          dispatchEvent(new DynamicEvent(DynamicEvent.PAUSED,null));
          break;
        case MediaPlayerState.BUFFERING:
          break;
        case MediaPlayerState.PLAYBACK_ERROR:
          break;
        case MediaPlayerState.LOADING:
          break;
        case MediaPlayerState.READY:
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
    }
    
    /**
     * Sends the ERROR event to the controller, which indicates the playback error.
     * @private
     * @method AkamaiHDPlayer#onMediaError
     * @param {MediaErrorEvent} event
     */
    private function onMediaError(event:MediaErrorEvent):void
    {
      switch(event.error["errorID"])
      {
        case MediaErrorCodes.HTTP_GET_FAILED:
        case MediaErrorCodes.NETCONNECTION_APPLICATION_INVALID:
        case MediaErrorCodes.NETCONNECTION_FAILED:
        case MediaErrorCodes.NETCONNECTION_REJECTED:
        case MediaErrorCodes.NETCONNECTION_TIMEOUT:
        case MediaErrorCodes.SECURITY_ERROR:
          break;
        case MediaErrorCodes.NETSTREAM_STREAM_NOT_FOUND:
        case MediaErrorCodes.MEDIA_LOAD_FAILED:
          break;
        case MediaErrorCodes.ARGUMENT_ERROR:
        case MediaErrorCodes.ASYNC_ERROR:
        case MediaErrorCodes.DRM_SYSTEM_UPDATE_ERROR:
        case MediaErrorCodes.DVRCAST_CONTENT_OFFLINE:
        case MediaErrorCodes.DVRCAST_STREAM_INFO_RETRIEVAL_FAILED:
        case MediaErrorCodes.DVRCAST_SUBSCRIBE_FAILED:
        case MediaErrorCodes.PLUGIN_IMPLEMENTATION_INVALID:
        case MediaErrorCodes.PLUGIN_VERSION_INVALID:
          break;
        case MediaErrorCodes.F4M_FILE_INVALID:
        case MediaErrorCodes.NETSTREAM_FILE_STRUCTURE_INVALID:
        case MediaErrorCodes.NETSTREAM_PLAY_FAILED:
        case MediaErrorCodes.SOUND_PLAY_FAILED:
          break;
        case MediaErrorCodes.NETSTREAM_NO_SUPPORTED_TRACK_FOUND:
          break;
        default:
          break;
      }
      Logger.log("Error: " + event.error["errorID"], " " + event.error.detail);
    }
    
    /**
     * Sends the SEEKED event to the controller, after seeking is completed successfully.
     * @protected
     * @method AkamaiHDPlayer#onSeekingChange
     * @param {SeekEvent} event
     */
    protected function onSeekingChange(event:SeekEvent):void
    {
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

      if ( _streamController.netStream == null )
      {
        _playQueue = true;
        _streamController.play(_akamaiStreamURL);
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
     * Calls function which takes video URL as parameter to load the video.
     * @public
     * @method AkamaiHDPlayer#onLoadVideo
     * @param {Event} event The event passed from the external interface.
     */
    public function onLoadVideo(event:DynamicEvent):void
    {
      _akamaiVideoSurface.width = stage.stageWidth;
      _akamaiVideoSurface.height = stage.stageHeight;

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
    }
    
    /**
     * Sets the closed captions mode
     * @public
     * @method AkamaiHDPlayer#onSetVideoClosedCaptionsMode
     * @param {Event} event The event passed from the external interface.
     */
    public function onSetVideoClosedCaptionsMode(event:DynamicEvent):void
    {
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
    }
    
    /**
     * Returns the current time of the video.
     * @public
     * @method AkamaiHDPlayer#onGetCurrentTime
     * @param {Event} event The event passed from the external interface.
     */
    public function onGetCurrentTime(event:Event):void
    {
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
     * @method AkamaiHDPlayer#totalBitratesAvailable
     */
    public function  totalBitratesAvailable():void
    { 
    }

    /**
     * Sets the bitrate and dispatches BITRATE_CHANGED event.
     * @public
     * @method AkamaiHDPlayer#onSetTargetBitrate
     * @param {DynamicEvent} event The event passed from the external interface.
     */
    public function onSetTargetBitrate(event:DynamicEvent):void
    { 
    }

    /**
     * Dispatches BITRATE_CHANGED event
     * @public
     * @method AkamaiHDPlayer#onBitrateChanged
     * @param {DynamicStreamEvent} event The event dispatched when the properties of a DynamicStreamTrait change.
     */
    private function onBitrateChanged(event:DynamicStreamEvent):void
    {
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
