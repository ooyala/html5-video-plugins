package 
{
	
	/**
	 * This interface represents a captioning parser and
	 * allows a plugin developer the means to create a 
	 * custom captioning plugin using a different file
	 * format.
	 */
	public interface ICaptioningParser
	{
		/**
		 * The parse method parses the captiong document
		 * and returns the root level of the Captioning
		 * document object model.
		 */
		function parse(rawData:String):CaptioningDocument;		
	}
}
