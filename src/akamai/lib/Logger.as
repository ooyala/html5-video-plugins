package
{
import flash.external.ExternalInterface;

  public class Logger
  {
    /**
     * Constructor
     * @public
     */
     public function Logger( )
     { 
     }
   
    /**
     * Send messages to the browser console log.In future this can be hooked to any other Debugging tools.
     * @private
     * @method ExternalJavaScriptAPI#sendToDebugger
     * @param {string} value The value to be passed to the browser console.
     * @param {string} referrer The fuction or process which passed the value.
     * @param {string} channelBranch It can be info, debug, warn, error or log.
     * @returns {boolean} True or false indicating success
     */
     public function sendToDebugger(value:String, referrer:String = null,
                                    channelBranch:String = "log"):Boolean
     {
       // channelBranch = info, debug, warn, error, log
       var channel:String = "OO." + channelBranch;
       if (referrer) referrer = "[" + referrer + "]";
       var debugMessage:Boolean = ExternalInterface.call(channel, "Akamai HD " + channelBranch + " " +
                                                        referrer + ": " + value);
       return debugMessage;
     }
  }
}