package
{
  import flash.events.Event;

 /**
  * This class is created to handle all the events dispatched from the player to the controller.
  */
  public dynamic class DynamicEvent extends Event
  {
    public static const PLAY:String = "PLAY";
    public static const PLAYING:String = "PLAYING";
    public static const ENDED:String = "ENDED";
    public static const ERROR:String = "ERROR";
    public static const SEEKED:String = "SEEKED";
    public static const PAUSED:String = "PAUSED";
    public static const BUFFERING:String = "BUFFERING";
    public static const BUFFERED:String = "BUFFERED";
    public static const TIME_UPDATE:String = "TIME_UPDATE";
    public static const VOLUME_CHANGED:String = "VOLUME_CHANGED";
    public static const CURRENT_TIME:String = "CURRENT_TIME";
    public static const BITRATES_AVAILABLE:String = "BITRATES_AVAILABLE";
    public static const BITRATE_CHANGED:String = "BITRATE_CHANGED";
    public static const SIZE_CHANGED:String = "SIZE_CHANGED";
    private var _eventObject:Object;

   /**
    * Constructor
    * @public
    */
    public function DynamicEvent(eventType:String, eventObject:Object = null, bubbles:Boolean = false,
                                       cancelable:Boolean = true)
    {
      super(eventType, bubbles, cancelable);
      _eventObject = eventObject;
    }

   /**
    * Getter method for the data member _eventObject.
    * @public
    * @method DynamicEvent#eventObject
    * @returns {Object} returns the data member_eventObject.
    */
    public function get eventObject():Object
    {
      return _eventObject;
    }

   /**
    * Function overrided from base class Event.
    * @public
    * @method DynamicEvent#clone
    * @returns {Event} returns new event of type DynamicEvent
    */
    override public function clone():Event
    {
      return new DynamicEvent(type, _eventObject, bubbles, cancelable);
    }
  }
}
