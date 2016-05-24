package
{
  import DynamicEvent;
  import AkamaiHDPlayer;
  import Logger;

  import flash.events.Event;
  import flash.events.TimerEvent;
  import flash.utils.getQualifiedClassName;
  import flash.external.ExternalInterface;
  import flash.utils.Timer;

  import mx.core.UIComponent;

  public class ExternalJavaScriptAPI extends UIComponent
  {
    private var _akamaiHDPlayer:AkamaiHDPlayer = null;
    private var _jsBridge:JFlashBridge = null;
    private var _dynamicEvent:DynamicEvent = null;

    /**
     * Constructor
     * @public
     */
    public function ExternalJavaScriptAPI(akamaiHDPlayer:AkamaiHDPlayer)
    {
      _akamaiHDPlayer = akamaiHDPlayer;
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
          Logger.log(error.message, "ExternalJavaScriptAPI : error");
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
      _akamaiHDPlayer.initMediaPlayer();
      registerListeners();
      _jsBridge = new JFlashBridge();
      _jsBridge.addMethod("jSBound", jSBound);
      _jsBridge.initialize();
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
      addEventListener("setInitialTime", onSetInitialTime);
      addEventListener("getCurrentTime", onGetCurrentTime);
      addEventListener("destroy", onDestroy);
      _akamaiHDPlayer.addEventListener(DynamicEvent.PLAY, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.PLAYING, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.ENDED, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.ERROR, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.SEEKED, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.PAUSED, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.BUFFERING, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.BUFFERED, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.TIME_UPDATE, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.VOLUME_CHANGED, onFlashEvent);
      _akamaiHDPlayer.addEventListener(DynamicEvent.CURRENT_TIME, onFlashEvent);
      //_akamaiHDPlayer.addEventListener(DynamicEvent.BITRATE_CHANGED, onFlashEvent);
      //_akamaiHDPlayer.addEventListener(DynamicEvent.BITRATES_AVAILABLE, onFlashEvent);
      //_akamaiHDPlayer.addEventListener(DynamicEvent.SIZE_CHANGED, onFlashEvent);
      Logger.log("events added", "registerListeners");
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
      removeEventListener("setInitialTime", onSetInitialTime);
      removeEventListener("getCurrentTime", onGetCurrentTime);
      removeEventListener("destroy", onDestroy);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.PLAY, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.PLAYING, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.ENDED, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.ERROR, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.SEEKED, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.PAUSED, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.BUFFERING, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.TIME_UPDATE, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.VOLUME_CHANGED, onFlashEvent);
      _akamaiHDPlayer.removeEventListener(DynamicEvent.CURRENT_TIME, onFlashEvent);
      //_akamaiHDPlayer.removeEventListener(DynamicEvent.BITRATE_CHANGED, onFlashEvent);
      //_akamaiHDPlayer.removeEventListener(DynamicEvent.BITRATES_AVAILABLE, onFlashEvent);
      //_akamaiHDPlayer.removeEventListener(DynamicEvent.SIZE_CHANGED, onFlashEvent);
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
      Logger.log(eventData.eventtype, "onFlashEvent");
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
      _akamaiHDPlayer.onVideoPlay(event);
    }

   /**
    * Initiates video pause functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onVideoPause
    * @param {Event} event
    */
    private function onVideoPause(event:Event):void
    {
      _akamaiHDPlayer.onVideoPause(event);
    }

   /**
    * Initiates video seek functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onVideoSeek
    * @param {DynamicEvent} event
    */
    private function onVideoSeek(event:DynamicEvent):void
    {
    }

   /**
    * Initiates volume change functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onChangeVolume
    * @param {DynamicEvent} event
    */
    private function onChangeVolume(event:DynamicEvent):void
    {
    }

   /**
    * Initiates playheadTimeChange functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onPlayheadTimeChanged
    * @param {Event} event
    */
    private function onPlayheadTimeChanged(event:TimerEvent = null):void
    {
    }

   /**
    * Passes the manifest url to the player.
    * @private
    * @method ExternalJavaScriptAPI#onSetVideoURL
    * @param {DynamicEvent} event
    */
    private function onSetVideoURL(event:DynamicEvent):void
    {
      _akamaiHDPlayer.onSetVideoURL(event);
    }

   /**
    * Initiates video load functionality through the player
    * @private
    * @method ExternalJavaScriptAPI#onLoadVideo
    * @param {DynamicEvent} event
    */
    private function onLoadVideo(event:DynamicEvent):void
    {
      _akamaiHDPlayer.onLoadVideo(event);
    }

   /**
    * Sets the closed captions for the video playback
    * @private
    * @method ExternalJavaScriptAPI#onSetVideoClosedCaptions
    * @param {Event} event
    */
    private function onSetVideoClosedCaptions(event:DynamicEvent):void
    {
    }
   
   /**
    * Sets the closed captions mode through the player
    * @private
    * @method ExternalJavaScriptAPI#onSetVideoClosedCaptionsMode
    * @param {Event} event
    */
    private function onSetVideoClosedCaptionsMode(event:DynamicEvent):void
    {
    }

   /**
    * Passes the initial time to the player, from which the playback is to be started.
    * @private
    * @method ExternalJavaScriptAPI#onSetInitialTime
    * @param {DynamicEvent} event
    */
    private function onSetInitialTime(event:DynamicEvent):void
    {
    }

    /**
    * Passes the target bitrate to the player.
    * @private
    * @method ExternalJavaScriptAPI#onSetTargetBitrate
    * @param {DynamicEvent} event
    */
    private function onSetTargetBitrate(event:DynamicEvent):void
    {
    }
    
   /**
    * Fetches the current time from the player.
    * @private
    * @method ExternalJavaScriptAPI#onGetCurrentTime
    * @param {Event} event
    */
    private function onGetCurrentTime(event:Event):void
    {
    }

   /**
    * Cleanup player.
    * @private
    * @method ExternalJavaScriptAPI#onDestroy
    * @param {Event} event
    */
    private function onDestroy(event:Event):void
    {
      _akamaiHDPlayer.onDestroy();
      destroy();
    }

    /**
     * This is an internal callback that passes data to
     * the JavaScript application
     * @method ExternalJavaScriptAPI#onCallback
     * @param {String} data
     */
    private function onCallback(data:String):void
    {
      Logger.log(data, "swf onCallback");
      var eventData : Object = new Object();
      eventData.eventtype = data;
      eventData.eventObject = null;
      _jsBridge.call("onCallback", eventData);
    }

    /**
     * This method is bound to the ExternalInterface to
     * receive data from the JavaScript application
     * @method ExternalJavaScriptAPI#jSBound
     * @param {String} data
     */
    private function jSBound(data:String):Object
    {
      Logger.log(data, "swf jSBound");
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
      var messageSent:Boolean = _jsBridge.call("onCallback", value);
      return messageSent;
    }

   /**
    * It is the callback function that receives data or events from the java script page.
    * @private
    * @method ExternalJavaScriptAPI#receivedFromJavaScript
    * @param {string} value The value to be send to the java script page.
    * @param {object} dataObj The object to be send to the java script page.
    */
    private function receivedFromJavaScript(value:String , dataObj:Object = null):void
    {
      var eventArgs:String = "";

      if (value.indexOf("(") != -1)
      {
        var start:int = value.indexOf("(");
        var end:int = value.lastIndexOf(")");
        eventArgs = (String)(value.slice(start + 1, end));
        value = (value.slice(0, start));
        Logger.log(eventArgs, "receivedFromJavaScript args");
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
      Logger.log(jsEvent.toString(), "receivedFromJavaScript event");
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
