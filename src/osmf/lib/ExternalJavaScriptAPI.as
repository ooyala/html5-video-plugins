package
{
  import DynamicEvent;
  import HDSPlayer;

  import flash.events.Event;
  import flash.events.TimerEvent;
  import flash.utils.getQualifiedClassName;
  import flash.external.ExternalInterface;
  import flash.utils.Timer;

  import mx.core.UIComponent;

  public class ExternalJavaScriptAPI extends UIComponent
  {
    private var _hdsPlayer:HDSPlayer = null;
    public var jsBridge:JFlashBridge;
    private var _dynamicEvent:DynamicEvent = null;
    private var thisVideoId:String = null;

    /**
     * Constructor
     * @public
     */
    public function ExternalJavaScriptAPI(hdsPlayer:HDSPlayer)
    {
      _hdsPlayer = hdsPlayer;
      if (ExternalInterface.available)
      {
        super();
        try
        {
          ExternalInterface.addCallback("sendToActionScript", receivedFromJavaScript);
          if (checkJavaScriptReady())
          {
            init();
          }
          else
          {
            var readyTimer:Timer = new Timer(100, 0);
            readyTimer.addEventListener(TimerEvent.TIMER, timerHandler);
            readyTimer.start();
          }
          ExternalInterface.addCallback("call", sendToJavaScript);
        }
        catch (error:Error)
        {
          SendToDebugger(error.message, "ExternalJavaScriptAPI","error");
        }
      }
      else
      {
        trace("JavaScript external interface is not available.");
      }
    }

   /**
    * Call the registerListeners function and initialize the jsBridge once JavaScript is ready
    * @private
    * @method ExternalJavaScriptAPI#init
    */
    private function init():void
    {
      _hdsPlayer.initMediaPlayer();
      registerListeners();
      jsBridge = new JFlashBridge();
      jsBridge.addMethod("onCallback", onCallback);
      jsBridge.initialize();
    }

    /**
     * Registers the event listners
     * @private
     * @method ExternalJavaScriptAPI#registerListeners
     */
    private function registerListeners():void
    {
      addEventListener("videoPlay", onVideoPlay);
      addEventListener("videoPause", onVideoPause);
      addEventListener("videoSeek", onVideoSeek);
      addEventListener("changeVolume", onChangeVolume);
      addEventListener("setVideoUrl", onSetVideoURL);
      addEventListener("load", onLoadVideo);
      addEventListener("playheadTimeChanged", onPlayheadTimeChanged);
      addEventListener("setVideoClosedCaptions", onSetVideoClosedCaptions);
      addEventListener("setVideoClosedCaptionsMode", onSetVideoClosedCaptionsMode);
      addEventListener("setTargetBitrate", onSetTargetBitrate);
      addEventListener("replay", onReplay);
      addEventListener("setInitialTime", onSetInitialTime);
      addEventListener("getCurrentTime", onGetCurrentTime);
      addEventListener("destroy", onDestroy);
      _hdsPlayer.addEventListener(DynamicEvent.PLAY, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.PLAYING, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.ENDED, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.ERROR, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.SEEKED, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.PAUSED, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.BUFFERING, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.BUFFERED, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.TIME_UPDATE, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.VOLUME_CHANGED, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.CURRENT_TIME, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.BITRATE_CHANGED, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.BITRATES_AVAILABLE, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.SIZE_CHANGED, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.CLOSED_CAPTION_CUE_CHANGED, onFlashEvent);
      SendToDebugger("events added", "registerListeners");
    }

    /**
     * Unregisters the event listners
     * @public
     * @method ExternalJavaScriptAPI#unregisterListeners
     */
    private function unregisterListeners():void
    {
      removeEventListener("videoPlay", onVideoPlay);
      removeEventListener("videoPause", onVideoPause);
      removeEventListener("videoSeek", onVideoSeek);
      removeEventListener("changeVolume", onChangeVolume);
      removeEventListener("setVideoUrl", onSetVideoURL);
      removeEventListener("load", onLoadVideo);
      removeEventListener("playheadTimeChanged", onPlayheadTimeChanged);
      removeEventListener("setVideoClosedCaptions", onSetVideoClosedCaptions);
      removeEventListener("setVideoClosedCaptionsMode", onSetVideoClosedCaptionsMode);
      removeEventListener("setTargetBitrate", onSetTargetBitrate);
      removeEventListener("replay", onReplay);
      removeEventListener("setInitialTime", onSetInitialTime);
      removeEventListener("getCurrentTime", onGetCurrentTime);
      removeEventListener("destroy", onDestroy);
      _hdsPlayer.removeEventListener(DynamicEvent.PLAY, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.PLAYING, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.ENDED, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.ERROR, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.SEEKED, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.PAUSED, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.BUFFERING, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.TIME_UPDATE, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.VOLUME_CHANGED, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.CURRENT_TIME, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.BITRATE_CHANGED, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.BITRATES_AVAILABLE, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.SIZE_CHANGED, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.CLOSED_CAPTION_CUE_CHANGED, onFlashEvent);
    }

    /**
     * Sends the events from the player to the controller.
     * @private
     * @method ExternalJavaScriptAPI#onFlashEvent
     * @param {DynamicEvent} event
     */
    private function onFlashEvent(event:DynamicEvent):void
    {
      var eventData : Object = new Object();
      eventData.eventtype = event.type;
      eventData.eventObject = event.eventObject;
      eventData.thisVideoId = thisVideoId;
      SendToDebugger(eventData.eventtype, "onFlashEvent", "log");
      sendToJavaScript(eventData);
    }

    /**
     * Initiates video play functionality through the player
     * @private
     * @method ExternalJavaScriptAPI#onVideoPlay
     * @param {Event} event
     */
    private function onVideoPlay(event:Event):void
    {
      _hdsPlayer.onVideoPlay(event);
    }

   /**
    * Initiates video pause functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onVideoPause
    * @param {Event} event
    */
    private function onVideoPause(event:Event):void
    {
      _hdsPlayer.onVideoPause(event);
    }

   /**
    * Initiates video seek functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onVideoSeek
    * @param {DynamicEvent} event
    */
    private function onVideoSeek(event:DynamicEvent):void
    {
      _hdsPlayer.onVideoSeek(event);
    }

   /**
    * Initiates volume change functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onChangeVolume
    * @param {DynamicEvent} event
    */
    private function onChangeVolume(event:DynamicEvent):void
    {
      _hdsPlayer.onChangeVolume(event);
    }

   /**
    * Initiates playheadTimeChange functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onPlayheadTimeChanged
    * @param {Event} event
    */
    private function onPlayheadTimeChanged(event:TimerEvent = null):void
    {
      _hdsPlayer.onPlayheadTimeChanged(event);
    }

   /**
    * Passes the manifest url to the player.
    * @private
    * @method ExternalJavaScriptAPI#onSetVideoURL
    * @param {DynamicEvent} event
    */
    private function onSetVideoURL(event:DynamicEvent):void
    {
      _hdsPlayer.onSetVideoURL(event);
    }

   /**
    * Initiates video load functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onLoadVideo
    * @param {DynamicEvent} event
    */
    private function onLoadVideo(event:DynamicEvent):void
    {
      _hdsPlayer.onLoadVideo(event);
    }

    /**
    * Sets the closed captions for the video playback
    * @private
    * @method ExternalJavaScriptAPI#onSetVideoClosedCaptions
    * @param {Event} event
    */
    private function onSetVideoClosedCaptions(event:DynamicEvent):void
    {
      _hdsPlayer.onSetVideoClosedCaptions(event);
    }

   /**
    * Sets the closed captions mode through the player
    * @private
    * @method ExternalJavaScriptAPI#onSetVideoClosedCaptionsMode
    * @param {Event} event
    */
    private function onSetVideoClosedCaptionsMode(event:DynamicEvent):void
    {
      _hdsPlayer.onSetVideoClosedCaptionsMode(event);
    }

   /**
    * Initiates replay functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onReplay
    * @param {Event} event
    */
    private function onReplay(event:Event):void
    {
      _hdsPlayer.onReplay(event);
    }

   /**
    * Passes the initial time to the player, from which the playback is to be started.
    * @private
    * @method ExternalJavaScriptAPI#onSetInitialTime
    * @param {DynamicEvent} event
    */
    private function onSetInitialTime(event:DynamicEvent):void
    {
      _hdsPlayer.onSetInitialTime(event);
    }

    /**
    * Passes the target bitrate to the player.
    * @private
    * @method ExternalJavaScriptAPI#onSetTargetBitrate
    * @param {DynamicEvent} event
    */
    private function onSetTargetBitrate(event:DynamicEvent):void
    {
      _hdsPlayer.onSetTargetBitrate(event);
    }

   /**
    * Fetches the current time from the player.
    * @private
    * @method ExternalJavaScriptAPI#onGetCurrentTime
    * @param {Event} event
    */
    private function onGetCurrentTime(event:Event):void
    {
      _hdsPlayer.onGetCurrentTime(event);
    }

   /**
    * Cleanup player.
    * @private
    * @method ExternalJavaScriptAPI#onDestroy
    * @param {Event} event
    */
    private function onDestroy(event:Event):void
    {
      _hdsPlayer.onDestroy();
      destroy();
    }

    // This is an internal callback that passes data to
    // the JavaScript application
    private function onCallback(data:String):void
    {
      SendToDebugger(data, "swf onCallback", "log");
      var eventData : Object = new Object();
      eventData.eventtype = data;
      eventData.eventObject = null;
      eventData.videoId = thisVideoId;
      jsBridge.call("onCallback", eventData);
    }

   /**
    * Send data or events to java script page.
    * @private
    * @method ExternalJavaScriptAPI#sendToJavaScript
    * @param {string} value The value to be send to the java script page.
    * @returns {boolean} True or false indicating success
    */
    private function sendToJavaScript(value:Object):Boolean
    {
      var messageSent:Boolean = jsBridge.call("onCallback", value);
      return messageSent;
    }

   /**
    * It is the callback function that receives data or events from the java script page.
    * @private
    * @method ExternalJavaScriptAPI#receivedFromJavaScript
    * @param {string} value The value to be send to the java script page.
    * @param {object} dataObj The object to be send to the java script page.
    */
    private function receivedFromJavaScript(value:String , dataObj:Object = null, videoId:String = null):void
    {
      var eventArgs:String = "";
      if (videoId != null && thisVideoId == null) thisVideoId = videoId;

      if (value.indexOf("(") != -1)
      {
        var start:int = value.indexOf("(");
        var end:int = value.lastIndexOf(")");
        eventArgs = (String)(value.slice(start + 1, end));
        value = (value.slice(0, start));
        SendToDebugger(eventArgs + " : " + videoId, "receivedFromJavaScript args", "log");
      }
      var jsEvent:DynamicEvent = new DynamicEvent(value);
      if (eventArgs != "")
      {
        jsEvent.args = eventArgs;
      }
      else if(dataObj != null)
      {
        jsEvent.args = dataObj;
      }
      dispatchEvent(jsEvent);
      SendToDebugger(jsEvent.toString() + " : " + videoId, "receivedFromJavaScript event", "log");
    }

   /**
    * Send messages to the Ooyala debugging log. In future this can be hooked to any other Debugging tools.
    * @private
    * @method HDSPlayer#SendToDebugger
    * @param {string} value The value to be passed to the debugger.
    * @param {string} referrer The fuction or process which passed the value.
    * @param {string} channelBranch It can be info, debug, warn, error or log.
    * @returns {boolean} True or false indicating success
    */
    private function SendToDebugger(value:String, referrer:String = null,
                                    channelBranch:String = "log"):Boolean
    {
      // channelBranch = info, debug, warn, error, log
      var channel:String = "OO." + channelBranch;
      if (referrer) referrer = "[" + referrer + " : " + thisVideoId + "]";
      var debugMessage:Boolean = ExternalInterface.call(channel, "HDSFlash " + channelBranch + " " +
                                                        referrer + ": " + value);
      return debugMessage;
    }


   /**
     * Unregisters events and resets all the private variables to defualt value.
     * @private
     * @method ExternalJavaScriptAPI#destroy
     */
    private function destroy():void
    {
      unregisterListeners();
    }

    private function timerHandler(event:TimerEvent):void
    {
      var isReady:Boolean = checkJavaScriptReady();
      if (isReady)
      {
        Timer(event.target).stop();
        init();
      }
    }
    private function checkJavaScriptReady():Boolean
    {
      // Call to 'isReady' in the Javascript. Prevents a race condition between config of ActionScript and JavaScript.
      var isReady:Boolean = ExternalInterface.call("isReady");
      return isReady;
    }
  }
}
