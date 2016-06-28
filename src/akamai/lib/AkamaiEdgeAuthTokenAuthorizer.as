package 
{
  import flash.events.Event;
  import flash.events.IOErrorEvent;
  import flash.external.ExternalInterface;
  import flash.utils.getTimer;
  import flash.net.URLLoader;
  import flash.net.URLRequest;
  import flash.events.IOErrorEvent;
  import flash.events.SecurityErrorEvent;
  import flash.utils.Timer;
  import flash.events.TimerEvent;
  import Logger;

  /**
   * The AkamaiEdgeAuthTokenAuthorizer fetches Akamai edge auth token necessary for Akamai Secure HD
   */
  public class AkamaiEdgeAuthTokenAuthorizer extends LoggingEventDispatcher
  {
    private var _edgeAuthToken:String;
    private var _sasServerWithProtocolAndPort:String;
    private var _loader:URLLoader = new URLLoader();
    public static const AUTH_COMPLETE:String = "authComplete";
    private static const URL_PATH:String = "/akamai_edge_auth_token";
    private static const MAX_RETRIES_FOR_AUTH:int = 5;
    private static const DEFAULT_INITIAL_RETRY_DELAY_MILLIS:int = 250;
    public static const MAX_RETRY_DELAY_MILLIS:int = 1000;
    private var _retryDelayMillis:int = DEFAULT_INITIAL_RETRY_DELAY_MILLIS;
    private var _maxRetryDelayMillis:int = MAX_RETRY_DELAY_MILLIS;
    private var _maxRetryForAuth:int = MAX_RETRIES_FOR_AUTH;
    private var _retryTimer:Timer;
    private var authURL:String;

    /**
     * Constructor
     * @public
     */
    public function AkamaiEdgeAuthTokenAuthorizer(sasServerWithProtocolAndPort:String = "")
    {
      _sasServerWithProtocolAndPort = sasServerWithProtocolAndPort;
      _loader.addEventListener(Event.COMPLETE, onLoaded);
      _loader.addEventListener(IOErrorEvent.IO_ERROR, onFail, false, int.MIN_VALUE);
      _loader.addEventListener(SecurityErrorEvent.SECURITY_ERROR, onFail, false, int.MIN_VALUE);
    }

    /**
     * Fetches the authorization parameters needed to securely stream the given embed code.
     */
    public function fetchEdgeAuthToken(embedCode:String, pcode:String):void
    {
      _edgeAuthToken = null;
      authURL = _sasServerWithProtocolAndPort + URL_PATH + "?embed_code=" + embedCode
          + "&video_pcode=" + pcode;
      loadUrl(authURL);
    }
    
    /**
     * Returns the edgeAuthToken needed to securely stream the given embed code.
     */
    public function get EdgeAuthToken():String { return _edgeAuthToken; }

    /**
     * Loads the secureHD url to get the secure token
     */
    public function loadUrl(url:String):void
    {
      _loader.load(new URLRequest(url));
    }

    /**
     * URLLoader notify us that the load failed. If maximum retries is greator than zero retries 
     * loading the url to get the auth token needed to securly stream the secureHD stream.
     */
    public function onFail(reason:String):void
    {
      if(_maxRetryForAuth > 0)
      {
        var delay:int = calculateDelayToNextRetry();
        _retryTimer = new Timer(delay, 1);
        _retryTimer.addEventListener(TimerEvent.TIMER_COMPLETE, function ():void {
        loadUrl(authURL);});
        _retryTimer.start();
        _maxRetryForAuth--;
      }
      else{
        Logger.log("Failed to fetch the secure token : " + reason, "setSecureContent");
        removeListeners();
      }
    }

    /**
     * Calculates the delay time for the next retry.
     */
    private function calculateDelayToNextRetry():int
    {
      var randomOffset:int = Math.random() * 100;
      var result:int = _retryDelayMillis + randomOffset;
      _retryDelayMillis = Math.min(_retryDelayMillis * 4, _maxRetryDelayMillis);
      return result;
    }

    /**
     * Remove the listeners.
     */
    private function removeListeners():void
    {
      _loader.removeEventListener(Event.COMPLETE, onLoaded);
      _loader.removeEventListener(IOErrorEvent.IO_ERROR, onFail);
      _loader.removeEventListener(SecurityErrorEvent.SECURITY_ERROR, onFail);
    }

    /**
     * Event handler for successful loads.
     */
    public function onLoaded(event:Event):void
    {
      _edgeAuthToken = _loader.data;
      dispatchEvent(new Event(AUTH_COMPLETE));
      removeListeners();
    }
  }
}