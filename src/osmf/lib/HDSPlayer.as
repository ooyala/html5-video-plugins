package
{
  import DynamicEvent;
  import ExternalJavaScriptAPI;
  
  import flash.display.Sprite;
  import flash.display.StageDisplayState;
  import flash.events.Event;
  import flash.events.MouseEvent;
  import flash.events.TimerEvent;
  import flash.external.ExternalInterface;
  import flash.system.Security;

  import flash.utils.Timer;
  
  import org.osmf.events.MediaErrorEvent;
  import org.osmf.events.MediaPlayerStateChangeEvent;
  import org.osmf.events.SeekEvent;
  import org.osmf.events.TimeEvent;
  import org.osmf.layout.ScaleMode;
  import org.osmf.media.DefaultMediaFactory;
  import org.osmf.media.MediaElement;
  import org.osmf.media.MediaPlayerSprite;
  import org.osmf.media.MediaPlayerState;

  import org.osmf.net.DynamicStreamingResource;
  import org.osmf.traits.MediaTraitType;
  import org.osmf.traits.SeekTrait;

  public class HDSPlayer extends Sprite
  { 
    private var _mediaFactory:DefaultMediaFactory = null;
    private var _mediaPlayerSprite:MediaPlayerSprite = null;
    private var _videoUrl:String = "";
    private var _initialTime:Number = 0;
    private var _playheadTimer:Timer = null;
    private var _seekTrait:SeekTrait = null;
    private var _playerState:String = "";
    
    /**
     * Constructor
     * @public
     */
    public function HDSPlayer( )
    {
      Security.allowDomain("*");
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
      _mediaPlayerSprite.mediaPlayer.addEventListener(MediaErrorEvent.MEDIA_ERROR,onMediaError);
      stage.addEventListener(MouseEvent.CLICK, onClickHandler);
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
      stage.removeEventListener(MouseEvent.CLICK, onClickHandler);
      if (_seekTrait != null)
      { 
        _seekTrait = null;
        _seekTrait.removeEventListener(SeekEvent.SEEKING_CHANGE, onSeekingChange);
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
    private function SendToDebugger(value:String, referrer:String = null, channelBranch:String = "info"):Boolean 
    {
      var channel:String = "console." + channelBranch;
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
      registerListeners();
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
          dispatchEvent(new DynamicEvent(DynamicEvent.PLAYING,null));
          break;
        case MediaPlayerState.PAUSED:
          dispatchEvent(new DynamicEvent(DynamicEvent.PAUSED,null));
          break;
        case MediaPlayerState.BUFFERING:
          dispatchEvent(new DynamicEvent(DynamicEvent.BUFFERING,null));
          break;
        case MediaPlayerState.PLAYBACK_ERROR:
          unregisterListeners();
          var eventObject:Object = new Object();
           eventObject.errorCode = -1;
          dispatchEvent(new DynamicEvent(DynamicEvent.ERROR,eventObject));
          break;
        case MediaPlayerState.LOADING:
        case MediaPlayerState.READY:
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
        case "HTTP_GET_FAILED":
        case "NETCONNECTION_APPLICATION_INVALID":
        case "NETCONNECTION_FAILED":
        case "NETCONNECTION_REJECTED":
        case "NETCONNECTION_TIMEOUT":
        case "SECURITY_ERROR":
          //eventObject.name = "MediaError.MEDIA_ERR_NETWORK";
          eventObject.errorCode = 2;
          break;
        case "NETSTREAM_STREAM_NOT_FOUND":
        case "MEDIA_LOAD_FAILED":
          //eventObject.name = "MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED";
          eventObject.errorCode = 4;
          break;
        case "ARGUMENT_ERROR":
        case "ASYNC_ERROR":
        case "DRM_SYSTEM_UPDATE_ERROR":
        case "DVRCAST_CONTENT_OFFLINE":
        case "DVRCAST_STREAM_INFO_RETRIEVAL_FAILED":
        case "DVRCAST_SUBSCRIBE_FAILED":
        case "PLUGIN_IMPLEMENTATION_INVALID":
        case "PLUGIN_VERSION_INVALID":
          //eventObject.name = "Unknown";
          eventObject.errorCode = -1;
          break;
        case "F4M_FILE_INVALID":
        case "NETSTREAM_FILE_STRUCTURE_INVALID":
        case "NETSTREAM_PLAY_FAILED":
        case "SOUND_PLAY_FAILED":
          //eventObject.name = "MediaError.MEDIA_ERR_DECODE";
          eventObject.errorCode = 3;
          break;
        case "NETSTREAM_NO_SUPPORTED_TRACK_FOUND":
          //eventObject.name = "NO_STREAM";
          eventObject.errorCode = 0;
          break;
      }
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
        dispatchEvent(new DynamicEvent(DynamicEvent.SEEKED,null));  
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
      if (_playerState == MediaPlayerState.READY || _playerState == MediaPlayerState.PAUSED)
      {
        _playheadTimer.start();
        _mediaPlayerSprite.mediaPlayer.play();
        //Starts the playback from the specified time, if some initial time is set already.
        if (_initialTime != 0)
        {
          _mediaPlayerSprite.mediaPlayer.seek(_initialTime);
          _initialTime = 0;
        }
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
      _playheadTimer.stop();
      _mediaPlayerSprite.mediaPlayer.pause();
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
      _seekTrait = _mediaPlayerSprite.mediaPlayer.media.getTrait(MediaTraitType.SEEK) as SeekTrait;
      if (_mediaPlayerSprite.mediaPlayer.canSeek &&
        (_mediaPlayerSprite.mediaPlayer.canSeekTo(time)))
      {
        _seekTrait.addEventListener(SeekEvent.SEEKING_CHANGE, onSeekingChange);
        _mediaPlayerSprite.mediaPlayer.seek(time);
        SendToDebugger("Seek to: " + time, "onVideoSeek");
      }
    }
    
    /**
     * Sets the volume of the player, through plugin, to the specivied value.
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
        SendToDebugger("Error in changing volume: " + _mediaPlayerSprite.mediaPlayer.volume, 
                      "onChangeVolume");
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
      _videoUrl = (String)(event.args);;
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
     * Puts the player in fullscreen mode, if it is in normal mode or vice versa. 
     * @public
     * @method HDSPlayer#onFullScreenChanged
     * @param {Event} event The event passed from the external interface.
     */        
    public function onFullScreenChanged(event:Event):void
    {
      stage.dispatchEvent(new MouseEvent(MouseEvent.CLICK));
    }
	
    public function onClickHandler(event:MouseEvent):void
    {
      //Resizes the player to full screen and vice versa. This fuction should be called with mouse click event 
      var eventObject:Object = new Object();
      if (stage.displayState == "normal")
      {
        try
        {
          stage.displayState = StageDisplayState.FULL_SCREEN;
          eventObject.isFullScreen = true;
          eventObject.paused = (_mediaPlayerSprite.mediaPlayer.state == "paused");
          dispatchEvent(new DynamicEvent(DynamicEvent.FULLSCREEN_CHANGED,
                                               (eventObject)));
        }
        catch (error:Error) 
        {
          //Dispatch error event
          SendToDebugger("Error on change to FullScreen: " + error.errorID+ "onFullScreenChanged");
        }
      }
      else if (stage.displayState == "fullScreen")
      {
        try
        {
          stage.displayState = StageDisplayState.NORMAL;
          eventObject.isFullScreen = false;
          eventObject.paused = (_mediaPlayerSprite.mediaPlayer.state == "paused");
          dispatchEvent(new DynamicEvent(DynamicEvent.FULLSCREEN_CHANGED,
                                               (eventObject)));				
        }
        catch (error:Error) 
        {
          //Dispatch error event
          SendToDebugger("Error on change from FullScreen: " + error.errorID+ "onFullScreenChanged");
        }
      }
      _mediaPlayerSprite.width = stage.stageWidth;
      _mediaPlayerSprite.height = stage.stageHeight;  
    }
    
    /*public function onClickHandler(event:MouseEvent):void
    {
      //Resizes the player to full screen and vice versa. This fuction should be called with mouse click event 
      var eventObject:Object = new Object();
      if (stage.displayState == "normal")
      {
        stage.displayState = StageDisplayState.FULL_SCREEN;    
        if (stage.displayState == "fullScreen")
        {  
          eventObject.isFullScreen = true;
          eventObject.paused = (_mediaPlayerSprite.mediaPlayer.state == "paused");
          dispatchEvent(new DynamicEvent(DynamicEvent.FULLSCREEN_CHANGED,
                       (eventObject)));
        }
      }
      else if (stage.displayState == "fullScreen")
      {
        stage.displayState = StageDisplayState.NORMAL;
        if (stage.displayState == "normal")
        {  
          eventObject.isFullScreen = false;
          eventObject.paused = (_mediaPlayerSprite.mediaPlayer.state == "paused");
          dispatchEvent(new DynamicEvent(DynamicEvent.FULLSCREEN_CHANGED,
                       (eventObject)));
        }
      }
      _mediaPlayerSprite.width = stage.stageWidth;
      _mediaPlayerSprite.height = stage.stageHeight;  
    }*/  

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
      seekRange.seekRange_start = 0;
      
      if (_mediaPlayerSprite.mediaPlayer.canSeek &&
        (_mediaPlayerSprite.mediaPlayer.canSeekTo(duration)))
      {
        seekRange.seekRange_end = duration;
      }
      else
      {
        seekRange.seekRange_end  = 0;
      }
      
      eventObject.currentTime = _mediaPlayerSprite.mediaPlayer.currentTime;
      eventObject.duration = duration
      eventObject.buffer = _mediaPlayerSprite.mediaPlayer.bufferLength;
      eventObject.seekRange = seekRange;
      dispatchEvent(new DynamicEvent(DynamicEvent.TIME_UPDATE,(eventObject)));
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
      _initialTime = time;
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
      eventObject.time = _mediaPlayerSprite.mediaPlayer.currentTime.toString();
      dispatchEvent(new DynamicEvent(DynamicEvent.CURRENT_TIME,(eventObject)));
    }

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
      // Take an URL of SmoothStreamingSource's manifest and add it to the page.
      SendToDebugger(sourceURL ,"loadMediaSource");

      var resource:DynamicStreamingResource = new DynamicStreamingResource( sourceURL );
      var element:MediaElement = _mediaFactory.createMediaElement( resource );
      _mediaPlayerSprite.scaleMode = ScaleMode.LETTERBOX;
      _mediaPlayerSprite.width = stage.stageWidth;
      _mediaPlayerSprite.height = stage.stageHeight;
      // Add the media element
      _mediaPlayerSprite.media = element;
      SendToDebugger("element " + element, "loadMediaSource");
      SendToDebugger("loadMediaSource LOADED", "loadMediaSource");
    }

    /**
     * Unregisters events and resets all the private variables to defualt value.
     * @private
     * @method HDSPlayer#destroy
     */
    private function destroy():void
    {
      unregisterListeners(); 
      _mediaFactory = null;
      _mediaPlayerSprite = null;
      _videoUrl = "";
      _initialTime = 0;
      _playheadTimer = null;
      _seekTrait = null;
      _playerState = "";
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
