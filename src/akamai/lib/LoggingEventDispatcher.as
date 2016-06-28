package 
{
  import flash.events.Event;
  import flash.events.EventDispatcher;
  import flash.events.IEventDispatcher;
  import flash.utils.Dictionary;

  /**
  * We need this class to control which events can be dispatched where and
  * which events should be routed between different APIs.
  *
  * As a side effect this class also supports try/catch for multiple listeners bound to same type.
  * (e.g. following listeners will be executed).
  */
  public class LoggingEventDispatcher implements IEventDispatcher
  {
    private const _listeners:Dictionary = new Dictionary();//type->array of listeners
    private var _base:EventDispatcher;

    /**
     * This should be set to match the current environment.
     */
    public static var isDebug:Boolean = false;

    public function LoggingEventDispatcher(target:IEventDispatcher = null)
    {
      _base = new EventDispatcher(target ? target : this);//had to use it to properly access fields of event object.
    }

    // Note: weak references are actually not supported.
    public function addEventListener(type:String, listener:Function, useCapture:Boolean = false, priority:int = 0, useWeakReference:Boolean = false):void
    {
      var l:Object = _listeners[type];
      if (l == null)
      {
        l = {arr:[], d:new Dictionary()};
        _listeners[type] = l;
        _base.addEventListener(type, dispatch);//bind to actual listener
      }
      const arr:Array = l.arr;
      const d:Dictionary = l.d;
      if (d[listener])
      {
        //Already has it.
        //In case of different priorities we still reject it - e.g. remove listener first to change its priority.
        return;
      }
      d[listener] = true;
      arr.push({p:priority, f:listener});
    }

    public function removeEventListener(type:String, listener:Function, useCapture:Boolean = false):void
    {
      var l:Object = _listeners[type];
      if (!l)
      {
        return;
      }

      const d:Dictionary = l.d;
      if (!d[listener])
      {
        return;
      }
      delete d[listener];
      const arr:Array = l.arr;
      if (arr.length == 1)
      {
        //Deleting the last listener for type
        delete _listeners[type];
        _base.removeEventListener(type, dispatch);
      }
      //Look for the listener
      var index:uint = 0;
      for (index = 0; index < arr.length; index++)
      {
        if (arr[index].f === listener)
        {
          arr.splice(index, 1);
          break;
        }
      }

    }

    /**
    * This function is bound as fake event listener to base implementation and
    * does actually invoke listeners.
    */
   private function dispatch(event:Event):void
    {
      var l:Object = _listeners[event.type];
      if (l == null)
      {
        return;
      }
      // before calling all the listeners, sort them on priority
      var listeners:Array = ArrayUtilsCopy(l.arr);
      listeners.sortOn("p", Array.DESCENDING | Array.NUMERIC);
      for each (var o:Object in listeners)
      {
        var f:Function = o.f;
        if (isDebug)
        {
          f(event);
        }
        else
        {
          runEventHandlerAndLogErrors(f, event);
        }
      }
    }
        public static function ArrayUtilsCopy(array:Array):Array
    {
      return array.slice();
    }

    /**
     * Runs an event handler for the given event, catching and logging any errors thrown by the event handler.
     *
     * This is factored out into a separate function to fix a bug in flex builder.  If this is inlined into
     * dispatch, if the event handler for the isDebug case throws an error, the flex builder debugger will
     * show the wrong stack trace when it breaks on the error, removing one or several function calls from the
     * stack, showing the thrown error as though it was thrown by dispatch() directly (on the line that calls
     * the event handler f).
     *
     * @param handler The event handler to call.
     * @param event The event to pass to the event handler.
     */
    private function runEventHandlerAndLogErrors(handler:Function, event:Event):void
    {
      try
      {
        handler(event);
      }
      catch (error:Error)
      {
       // Logger.log("An error during event dispatching", error.getStackTrace() || error.toString());
      }
    }

    /**
    *IEventDispatcher Interface method dispatchEvent
    */
    public function dispatchEvent(event:Event):Boolean
    {
      return _base.dispatchEvent(event);
    }

    /**
    *IEventDispatcher Interface method hasEventListener
    */    
    public function hasEventListener(type:String):Boolean
    {
      return _base.hasEventListener(type);
    }

    /**
    *IEventDispatcher Interface method willTrigger
    */    
    public function willTrigger(type:String):Boolean
    {
      return _base.willTrigger(type);
    }

  } 
}
