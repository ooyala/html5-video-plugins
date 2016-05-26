package
{
  import flash.events.TimerEvent;
  import flash.external.ExternalInterface;
  import flash.utils.Timer;

  public class JFlashBridge
  {
    public var objectName:String = "";
    public var jsReadyFuncName:String = "isJSReady";     // optional
    public var swfLoadedFuncName:String = "onSWFLoaded"; // optional
    private var _available:Boolean = false;

    /**
     * Constructor
     * @public
     */
    public function JFlashBridge()
    {
    }

    /**
     * Checks whether the ExternalInterface is available and initializes the timer accordingly.
     * @prublic
     * @method JFlashBridge#initialize
     */
    public function initialize():void
    {
      if (ExternalInterface.available)
      {
        objectName = getSWFObjectName();
        var eventData : Object = new Object();
        eventData.eventtype = "JSREADY";
        eventData.eventObject = null;

        call("onCallback", eventData);
        try
        {
          if (checkReady()) {
            available = true;
          } else {
            trace("JavaScript is not ready yet, creating timer.");
            var readyTimer:Timer = new Timer(100, 0);
            readyTimer.addEventListener(TimerEvent.TIMER, onReadyTimer);
            readyTimer.start();
          }
        }
        catch (error:SecurityError)
        {
          trace("A SecurityError occurred: " + error.message);
        }
        catch (error:Error)
        {
          trace("An Error occurred: " + error.message);
        }
      }
      else
      {
        trace("JavaScript external interface is not available.");
      }
    }

    /**
     * Adds a callback for receiving method calls from external JavaScript interface.
     * @public
     * @method JFlashBridge#addMethod
     * @param {string} name Name of the method for which callback to be added.
     * @param {Function} callback The callback fuction.
     */
    public function addMethod(name:String, callback:Function):void
    {
      ExternalInterface.addCallback(name, callback);
    }

    /**
     * Calls an external JavaScript method.
     * @public
     * @method JFlashBridge#call
     * @param {string} method Name of the method to be called.
     */
   /* public function call(method:String, data:Object = null):*
    {

      data.thisVideoId = ExternalInterface.objectID;
      return ExternalInterface.call(method, data);
    }*/
   public function call(method:String, ...parameters):* {
      var args:Array = [];
      args.push("call");
      args.push(objectName);
      args.push(method);
      return ExternalInterface.call.apply(ExternalInterface, args.concat(parameters));
    } 

    /**
     * Returns the SWF's object name for getElementById
     * @public
     * @method JFlashBridge#getSWFObjectName
     * @returns {String} Name of the SWF object.
     */
    public function getSWFObjectName():String
    {
      var js:XML;
      js = <script><![CDATA[
        function(__randomFunction) {
          var check = function(objects){
            for (var i = 0; i < objects.length; i++){
              if (objects[i][__randomFunction]) return objects[i].id;
            }
            return undefined;
        };
        return check(document.getElementsByTagName("object")) || check(document.getElementsByTagName("embed"));
      }
      ]]></script>;

      var __randomFunction:String = "checkFunction_" + Math.floor(Math.random() * 99999); // Something random just so it's safer
      ExternalInterface.addCallback(__randomFunction, getSWFObjectName); // The second parameter can be anything, just passing a function that exists

      return ExternalInterface.call(js, __randomFunction);
    }

    /**
     * Checks for ready condition.
     * @private
     * @method JFlashBridge#checkReady
     * @returns {boolean} True or false indicating the ready condition.
     */
    private function checkReady():Boolean
    {
      var res:* = call(jsReadyFuncName);
      if (res == undefined ||
        res == null) {
        // If no function exists then we return ready.
        return true;
      }
      return Boolean(res);
    }

    /**
     * Event listener for TimerEvent.
     * @private
     * @method JFlashBridge#onReadyTimer
     * @param {TimerEvent} event
     */
    private function onReadyTimer(event:TimerEvent):void
    {
      var isReady:Boolean = checkReady();
      trace("JavaScript ready status: ", isReady);
      if (isReady) {
        Timer(event.target).stop();
        available = true;
      }
    }

    /**
     * Getter method for the data member _available.
     * @public
     * @method JFlashBridge#get available
     * @returns {boolean} Returns the data member _available.
     */
    public function get available():Boolean { return _available; }

    /**
     * Setter method for the data member _available.
     * @public
     * @method JFlashBridge#sset available
     * @param {Boolean} value True or False.
     */
    public function set available(value:Boolean):void
    {
      if (_available != value) {
        _available = value;
        if (_available) {
          call(swfLoadedFuncName);
        }
      }
    }
  }
}
