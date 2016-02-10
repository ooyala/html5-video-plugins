package 
{
	import flash.errors.IllegalOperationError;
	
	import __AS3__.vec.Vector;
	
	import org.osmf.utils.OSMFStrings;
	import flash.events.EventDispatcher;
	import flash.events.Event;
	import flash.external.ExternalInterface;
	
	/**
	 * This class represents the root level object
	 * in the Captioning document object model.
	 */
	public class CaptioningDocument
	{
		// Use Class Event handler.
		protected static var disp:EventDispatcher;
		public static const CAPTION_READY:String = "onCaptionReady";
		/**
		 * The title, if it was found in the metadata in the header.
		 */
		public function get title():String 
		{
			return _title;
		}
		
		public function set title(value:String):void
		{
			_title = value;
		}
		
		/**
		 * The description, if it was found in the metadata in the header.
		 */
		public function get description():String 
		{
			return _desc;
		}
		
		public function set description(value:String):void
		{
			_desc = value;
		}
			
		/**
		 * Add a caption object.
		 */
		public function addCaptionsArray(captionArray:Object,captionslength:Number,availableLanguage:Array):void
		{			
			_captionsArray=captionArray;
			_captionsLength=captionslength;
			_availableLanguage=availableLanguage;
			dispatchEvent(new Event(CAPTION_READY));
				
		} 

		/**
		 * Add static access events to class.
		 */
		public static function addEventListener(p_type:String, p_listener:Function, p_useCapture:Boolean=false, p_priority:int=0, p_useWeakReference:Boolean=false):void
		{
		
		  if (disp == null) { disp = new EventDispatcher(); }
		  disp.addEventListener(p_type, p_listener, p_useCapture, p_priority, p_useWeakReference);
		}
		
		/**
		 * remove static access events from class.
		 */
		public static function removeEventListener(p_type:String, p_listener:Function, p_useCapture:Boolean=false):void
		{
		  if (disp == null) { return; }
		  disp.removeEventListener(p_type, p_listener, p_useCapture);
		}

		/**
		 * dispatch event.
		 */
		public static function dispatchEvent(p_event:Event):void
		{
		  if (disp == null) { return; }
			disp.dispatchEvent(p_event);
		}

		/**
		 * Returns the number of caption objects in this class'
		 * internal collection.
		 */
		public function get numCaptions():int
		{
			return _captionsLength;
		}
		
		/**
		 * Returns the caption object at the index specified.
		 * 
		 * @throws IllegalOperationError If index argument is out of range.
		 */
		public function getCaptionAt(index:int):Caption
		{
			_captions=_captionsArray[_availableLanguage[0]];
			
			if (_captions == null || index >= _captions.length)
			{
				throw new IllegalOperationError(OSMFStrings.getString(OSMFStrings.INVALID_PARAM));
			}
			
			return _captions[index];
		}
		
		private var _title:String;
		private var _desc:String;
		private var _captions:Vector.<Caption>;
		public var _captionsLength:Number; 
		public var _availableLanguage:Array= new Array();
		public  static var _captionsArray:Object= new Object();
	}
}
