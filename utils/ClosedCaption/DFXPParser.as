package 
{
	import flash.external.ExternalInterface;


	/**
	 * This class parses a W3C Timed Text DFXP file and
	 * creates a document object model representation of 
	 * the file by returning a <code>CaptioningDocument</code> object
	 * from the <code>parse</code> method.  A load failure translates to
	 * an OSMF media load failed message.
	 */
	public class DFXPParser implements ICaptioningParser
	{
		/**
		 * Constructor.
		 */
		public function DFXPParser()
		{
			super();
		}

		/**
		 * Parses the raw data passed in which should represent
		 * a W3C Timed Text DFXP file and returns a <code>CaptioningDocument</code>
		 * object which represents the root level object of the file's
		 * document object model.
		 */
		public function parse(rawData:String):CaptioningDocument
		{           
			rawData = rawData.replace(/\s+$/, "");
			rawData = rawData.replace(/>\s+</g, "><");
			rawData = rawData.replace(/\r\n/g, "\n");
			
			if (rawData == null || rawData.length == 0) { return null; }
			var document:CaptioningDocument = new CaptioningDocument();

			
			var saveXMLIgnoreWhitespace:Boolean = XML.ignoreWhitespace;
			var saveXMLPrettyPrinting:Boolean = XML.prettyPrinting; 
			
			XML.ignoreWhitespace = false;
			XML.prettyPrinting = false;
			
			var xml:XML = new XML(rawData);
			// restore the old value:
			XML.ignoreWhitespace = saveXMLIgnoreWhitespace;
			XML.prettyPrinting = saveXMLPrettyPrinting;
			
			if (xml == null || xml.localName() == null || xml.localName() != "tt")
			{
				throw new Error("Invalid XML for this movie");
				return;
			}
			// Set proper namespace:
			xmlns = xml.namespace();
			ns = xml.namespace();
			rootNamespace = xml.namespace();

			xmlNamespace = new Namespace("http://www.w3.org/XML/1998/namespace");
			default xml namespace = new Namespace(xmlns.uri);
			tts = new Namespace("tts", xmlns.uri + "#styling");
			ttp = new Namespace("ttp", xmlns.uri + "#parameter");
			ttm = new Namespace("ttm", xmlns.uri + "#metadata");

			// Validate the timeBase attribute if it is defined.
			checkValidTimeBaseAttribute(xml.@ttp::timeBase);
			
			try 
			{
				parseHead(document, xml);
				parseBody(document, xml);		
			}
			catch (err:Error) 
			{
				debugLog("Unhandled exception in DFXPParser : "+err.message);
			}
			
			return document;
		}		
		
		/**
		 * Checks for the valid time base attribute.
		 */	
		private function checkValidTimeBaseAttribute(timeBaseAttribute:XMLList):void
		{
			if (timeBaseAttribute.length() > 0 && timeBaseAttribute[0].toString() != "media")
			{
				debugLog("Invalid timeBaseAttr:" + timeBaseAttribute[0].toString());
				return;
			}
		}
		/**
		 * Parses the title and description present in dfxp and adds the info to the doc.
		 */	
		private function parseHead(doc:CaptioningDocument, xml:XML):void 
		{
			// Metadata - not required
			try 
			{
				doc.title = xml..ttm::title.text();
				doc.description = xml..ttm::desc.text();
			}
			catch (err:Error) 
			{
					debugLog("Error in parseHead"+err.message);
			}	
		}
		
		/**
		 * Parses the body tag present in dfxp and adds the object of caption with the corresponding language to the doc.
		 */	
		private function parseBody(doc:CaptioningDocument, xml:XML):void 
		{
		    // The <body> tag is required
			var body:XMLList = xml..ns::body;
			if (body.length() <= 0) 
			{
				debugLog("Invalid DFXP document: <body> tag is required.");
			}
			else
			{
				// Support for one <div> tag only, but it is not required
				var divTags:XMLList =body[0].div;
				if (divTags.length() < 1)
				{
					// todo: make this more clear, if a user were to see it what would they say?
					debugLog("must have at least one div element");
				}
				
				for each (var divNode:XML in divTags)
				{	
					var divLang:String = divNode.@xmlNamespace::lang ;
					_availableLanguage.push(divLang);
					// if there is begin attribute for the div tag, that is an unsupported div Node for us, ignore it.
					if (divNode["@begin"].length >= 1) { continue; }
					_captionsObject[divLang] = (parseDivNode(divNode,doc));
				}
				doc.addCaptionsArray(_captionsObject, _numOfCaption, _availableLanguage);
			}
		}
		
		/**
		 * Parses the div tag present in the body tag and returns the Vector of Captions.
		 */	
		private function parseDivNode(divNode:XML,doc:CaptioningDocument):Vector.<Caption>
		{
			var pTags:XMLList =  divNode.children();
			var pTagsLength:int = pTags ? pTags.length() : 0;
			// Support for 1 to many <p> tags, these tags contain the timing info, they can appear in any order
			
			// Captions should be in <p> tags
			_captions = new Vector.<Caption>();
			for (var i:uint = 0; i < pTagsLength; i++) 
			{
				var pNode:XML = pTags[i];
					
				// According the W3C, foreign namespaces should be ignored for p tags
				if (rootNamespace == pNode.namespace())
				{
					
			     	var caption:Caption =parsePTag(doc, pNode, i);
					if((i == 0 || _captions[_captions.length-1].start != caption.start)&& caption!=null)
					{
						_captions.push(caption);
					}
					else if((_captions[_captions.length-1].start == caption.start)&& caption!=null)
					{
						var firstCaption:Caption = _captions[_captions.length-1];
						_captions[_captions.length-1].text = firstCaption.text + "\n" + caption.text;
						// update the endTime to longest if actually defined
						if(!isNaN(firstCaption.end) && !isNaN(caption.end))
						{
							_captions[_captions.length-1].end = Math.max(firstCaption.end, caption.end);
						}
					}
					else
					{
						debugLog("Incorrect DFXP");
						return null;
					}
				}
				else
				{
					debugLog("Ignoring this tag, foreign namespaces not supported: \""+pNode+"\"");
				}
			}
			_numOfCaption = _captions.length;
			return _captions;
		}
		
		/**
		 * Parses the p tag present in the div tag and returns the Caption.
		 */	
		private function parsePTag(doc:CaptioningDocument, pNode:XML, index:uint):Caption 
		{
			// For timing attributes, we support 'begin', 'dur', 'end', all others are ignored.
			// If the attribute 'begin' is missing, we default to zero.
			// If both 'dur' and 'end' are present, the 'end' attribute is used
			
			var begin:String = pNode.@begin;
			var end:String = pNode.@end;
			var dur:String = pNode.@dur;
										
			// If no 'begin' default to 0 seconds
			if (begin == "") 
			{
				begin = "0s";
			}
			
			// Format begin in seconds
			var beginSecs:Number = parseTime(begin);
			
			var endSecs:Number = 0;
			
			// If we found both 'end' and 'dur', ignore 'dur'
			if (end != "") 
			{
				endSecs = parseTime(end);
			}
			else if (dur != "") 
			{
				endSecs = beginSecs + parseTime(dur);
			}
									
			var captionFormatList:Array = new Array();

			// Create the caption text, we don't support nested span tags
			var text:String = new String("<p>");
			
			var children:XMLList = pNode.children();
			for (var i:uint = 0; i < children.length(); i++) 
			{
				var child:XML = children[i];
				switch (child.nodeKind()) 
				{
					case "text":
						text += formatCCText(child.toString());
						break;
					case "element":
						switch (child.localName()) 
						{
							case "set":
							case "metadata":
								break;	// We don't support these in <p> tags
							case "span":
								var spanText:String;
								text += parseSpanTag(doc, child);
								break;
							case "br":
								text += "<br />";
								break;
							default:
								text += formatCCText(child.toString());
								break;
						}
						break;
				}
			}
			
			text += "</p>";

			var captionItem:Caption = new Caption(index, beginSecs, endSecs, text);
			if(isNaN(captionItem.start))
			{
				return null;
			}
			return captionItem;
		}
    
    /**
		 * Parses and returns the time of the Caption.
		 */	
		private  function parseTime(value:String):Number 
    {
			var time:Number = 0;
			var captionTimeArray:Array = value.split(":");
			if (captionTimeArray.length == 3) 
			{
				// Clock format, e.g. "hh:mm:ss"
				time = captionTimeArray[0] * 3600;
				time += captionTimeArray[1] * 60;
				time += Number(captionTimeArray[2]);
			}
			else if(captionTimeArray.length == 2)
			{
				time += captionTimeArray[0] * 60;
				time += Number(captionTimeArray[1]);
			}
			else if(captionTimeArray.length == 1)
			{
				time += Number(captionTimeArray[0]);		
			}
			else 
			{
				// Offset time format, e.g. "1h", "8m", "10s"
				var offsetTime:int = 0;
				switch (value.charAt(value.length-1)) 
				{
					case 'h':
						offsetTime = 3600;
						break;
					case 'm':
						offsetTime = 60;
						break;
					case 's':
						offsetTime = 1;
						break;
				}
				if (offsetTime) 
				{
					time = Number(value.substr(0, value.length-1)) * offsetTime;
				}
				else 
				{
					time = Number(value);
				}
			}
			return time;
		}
		
		/**
		 * Parses the span tag present in the div tag and returns the String.
		 */	
		private function parseSpanTag(doc:CaptioningDocument, spanNode:XML):String 
		{
			var ccText:String = new String();
			var children:XMLList = spanNode.children();
			
			for (var i:uint = 0; i < children.length(); i++ ) 
			{
				var child:XML = children[i];
				
				switch (child.nodeKind()) 
				{
					case "text":
						ccText += formatCCText(child.toString());
						break;
					case "element":
						switch (child.localName()) 
						{
							case "set":
							case "metadata":
								break;	// We don't support these in <span> tags
							case "br":
								ccText += "<br/>";
								break;
							default:
								ccText += child.toString();
								break;
						}
						break;
				}
			}

			return ccText;
		}
				
		private function formatCCText(txt:String):String 
		{
			var retString:String = txt.replace(/\s+/g, " ");
			return retString;
		}
					
		private function debugLog(msg:String):void
		{
			ExternalInterface.call("console.log"," "+msg);
		}
		private var xmlNamespace:Namespace;
		private var ns:Namespace;
		private var ttm:Namespace;
		private var tts:Namespace;
		private var ttp:Namespace;
		private var xmlns:Namespace;
		private var rootNamespace:Namespace;
		private var _availableLanguage:Array= new Array();
		private var _captionsObject:Object=new Object();
		private var _captions:Vector.<Caption>;
		private var _numOfCaption:Number;
				
	}
}
