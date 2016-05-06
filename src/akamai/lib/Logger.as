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
     * @method ExternalJavaScriptAPI#log
     * @param {string} value The value to be passed to the browser console.
     * @param {string} referrer The fuction or process which passed the value.
     * @param {string} channelBranch It can be info, debug, warn, error or log.
     * @returns {boolean} True or false indicating success
     */
     public static function log(value:String, referrer:String = null):Boolean
     {
       var channel:String = "OO.log";
       if (referrer) referrer = "[" + referrer + "]";
       var debugMessage:Boolean = ExternalInterface.call(channel, "Akamai HD " +
                                                        referrer + ": " + value);
       return debugMessage;
     }
  }
}