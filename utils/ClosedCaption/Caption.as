package 
{
	import org.osmf.metadata.TimelineMarker;

	/**
	 * Represents a caption, including text and style formatting information, 
	 * as well as when to show the caption and when to hide it.
	 */
	public class Caption extends TimelineMarker
	{
		/**
		 * Constructor.
		 * 
		 * @param id The caption id if supplied (optional).
		 * @param start The time in seconds the media when the caption should appear.
		 * @param end The time in seconds the media when the caption should no longer appear.
		 * @param captionText The caption text to display.
		 */
		public function Caption(id:uint, start:Number, end:Number, captionText:String)
		{
			var duration:Number = end > 0 ? (end - start) : NaN;
			super(start, duration);
			
			_id = id;
			_captionText = captionText;
			_start=start;
			_end=end;
		}
		
		/**
		 * Returns the caption text which will include embedded HTML
		 * tags. To get the caption text without embedded HTML tags,
		 * use the <code>clearText<code> property.
		 */
		public function get text():String
		{
			return _captionText;
		}
		public function set text(captionText:String):void
		{			
			_captionText= captionText;
		}
		
		/**
		 * Returns the caption text without embedded HTML tags.
		 */
		public function get clearText():String
		{
			var clrTxt:String = "";
			if (_captionText != null && _captionText.length > 0)
			{
				clrTxt = _captionText.replace(/<(.|\n)*?>/g, "");
			}
			return clrTxt;
		}

		/**
		 * Returns the caption id of the caption
		 */
		public function get id():uint
		{
			return _id;
		}

		/**
		 * Returns the caption start time of the caption
		 */
		public function get start():Number
		{
			return _start;
		}
		
		/**
		 * Returns the caption end time of the caption
		 */
		public function get end():Number
		{
			return _end;
		}
		public function set end(endTime:Number):void
		{			
			_end= endTime;
		}
		
		private var _id:uint;
		private var _captionText:String;	// The text to display, can contain embedded html tags, such as <br/>
		private var _end:Number;
		private var _start:Number;
	}
}
