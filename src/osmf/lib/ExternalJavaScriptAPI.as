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
          ExternalInterface.addCallback("sendToJavaScript", sendToJavaScript);
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
      jsBridge.addMethod("someMethod", someMethod);
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
      addEventListener("fullScreenChanged", onFullScreenChanged);
      /*addEventListener("rateChange", onRateChanged);
      addEventListener("stalled", onStalled);
      addEventListener("progress", onProgress);
      addEventListener("videoEnd", onVideoEnd );
      addEventListener("error", onErrorCode);
      addEventListener("durationChanged", onDurationChanged);
      addEventListener("waiting", onWaiting);
      addEventListener("timeUpdate", onTimeUpdate);
      addEventListener("canPlayThrough", onCanPlayThrough);
      addEventListener("playing", onPlaying);
      addEventListener("seeking", onSeeking);*/
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
      _hdsPlayer.addEventListener(DynamicEvent.FULLSCREEN_CHANGED, onFlashEvent);
      _hdsPlayer.addEventListener(DynamicEvent.CURRENT_TIME, onFlashEvent);
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
      removeEventListener("fullScreenChanged", onFullScreenChanged);
      /*removeEventListener("rateChange", onRateChanged);
      removeEventListener("stalled", onStalled);
      removeEventListener("progress", onProgress);
      removeEventListener("videoEnd", onVideoEnd );
      removeEventListener("error", onErrorCode);
      removeEventListener("durationChanged", onDurationChanged);
      removeEventListener("waiting", onWaiting);
      removeEventListener("timeUpdate", onTimeUpdate);
      removeEventListener("canPlayThrough", onCanPlayThrough);
      removeEventListener("playing", onPlaying);
      removeEventListener("seeking", onSeeking);*/
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
      _hdsPlayer.removeEventListener(DynamicEvent.FULLSCREEN_CHANGED, onFlashEvent);
      _hdsPlayer.removeEventListener(DynamicEvent.CURRENT_TIME, onFlashEvent);
    }

    /**
     * Sends the events from the player to the controller.
     * @private
     * @method ExternalJavaScriptAPI#onFlashEvent
     * @param {DynamicEvent} event
     */
    private function onFlashEvent(event:DynamicEvent):void
    {
      /*
      sendToJavaScript(event.type);
      if (event.eventObject != null)
      {
        var eventObject:Object = event.eventObject;
        for (var key:String in eventObject)
        {
          if (getQualifiedClassName(eventObject[key]) == "Object")
          {
            var innerObject:Object = eventObject[key];
            for (var key2:String in innerObject)
            {
              sendToJavaScript(key2 + ":" + innerObject[key2]);
            }
          }
          else
          {
            sendToJavaScript(key + ":" + eventObject[key]);
          }
        }
      }
      */
      var eventData : Object = new Object();
      eventData.eventtype = event.type;
      eventData.eventObject = event.eventObject;
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
    * Initiates full screen functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onFullScreenChanged
    * @param {Event} event
    */
    private function onFullScreenChanged(event:Event):void
    {
      _hdsPlayer.onFullScreenChanged(event);
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
      SendToDebugger(data, "swf onCallback", "info");
      var eventData : Object = new Object();
      eventData.eventtype = data;
      eventData.eventObject = null;
      jsBridge.call("onCallback", eventData);
    }

    // This method is bound to the ExternalInterface to
    // receive data from the JavaScript application
    private function someMethod(data:String):Object
    {
      SendToDebugger(data, "swf someMethod", "info");
      onCallback(data);
      return data;
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
    */
    private function receivedFromJavaScript(value:String):void
    {
      var eventArgs:String = "";

      if (value.indexOf("(") != -1)
      {
        var start:int = value.indexOf("(");
        var end:int = value.lastIndexOf(")");
        eventArgs = (String)(value.slice(start + 1, end));
        value = (value.slice(0, start));
        SendToDebugger(eventArgs, "receivedFromJavaScript args", "info");
      }
      var jsEvent:DynamicEvent = new DynamicEvent(value);
      if (eventArgs != "")
      {
        jsEvent.args = eventArgs;
      }
      dispatchEvent(jsEvent);
      SendToDebugger(jsEvent.toString(), "receivedFromJavaScript event", "info");
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
    private function SendToDebugger(value:String, referrer:String = null,
                                    channelBranch:String = "info"):Boolean
    {
      // channelBranch = info, debug, warn, error, log
      var channel:String = "console." + channelBranch;
      if (referrer) referrer = "[" + referrer + "]";
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
   /**
    * Sends the error code
    * @private
    * @method ExternalJavaScriptAPI#onErrorCode
    * @param {DynamicEvent} event
    */
    /*private function onErrorCode(event:DynamicEvent):void
    {
      _hdsPlayer.onErrorCode(event);
      var eventLog:String = event.toString();
      SendToDebugger(eventLog, "onErrorCode", "error");
    }

   /**
    * Initiates video end functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onVideoEnd
    * @param {Event} event
    */
    /*private function onVideoEnd(event:Event):void
    {
      _hdsPlayer.onVideoEnd(event);
    }

    private function onRateChanged(event:Event):void
    {
      _hdsPlayer.onRateChanged(event);
    }

    private function onStalled(event:Event):void
    {
      _hdsPlayer.onStalled(event);
    }

    private function onProgress(event:Event):void
    {
      _hdsPlayer.onProgress(event);
    }

    private function onDurationChanged(event:Event):void
    {
      _hdsPlayer.onDurationChanged(event);
    }

    private function onWaiting(event:Event):void
    {
      _hdsPlayer.onWaiting(event);
    }

    private function onTimeUpdate(event:Event):void
    {
      _hdsPlayer.onTimeUpdate(event);
    }

    private function onCanPlayThrough(event:Event):void
    {
      _hdsPlayer.onCanPlayThrough(event);
    }

    private function onPlaying(event:Event):void
    {
      _hdsPlayer.onPlaying(event);
    }

    private function onSeeking(event:Event):void
    {
      _hdsPlayer.onSeeking(event);
    }*/

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
