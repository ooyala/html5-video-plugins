package 
{
	import org.osmf.utils.TimeUtil;

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
			xmlNamespace = new Namespace("http://www.w3.org/XML/1998/namespace");
			var document:CaptioningDocument = new CaptioningDocument();
			var saveXMLIgnoreWhitespace:Boolean = XML.ignoreWhitespace;
			var saveXMLPrettyPrinting:Boolean = XML.prettyPrinting; 
			
			// Remove line ending whitespaces
			var xmlStr:String = rawData.replace(/\s+$/, "");
			
			// Remove whitespaces between tags
			xmlStr = xmlStr.replace(/>\s+</g, "><");

			// Tell the XML class to show white space in text nodes		
			XML.ignoreWhitespace = false;
			// Tell the XML class not to normalize white space for toString() method calls
			XML.prettyPrinting = false;
			
			try
			{
				var xml:XML = new XML(xmlStr);
			}
			catch (e:Error)
			{
				debugLog("Unhandled exception in DFXPParser : "+e.message);
				throw e;				
			}
			finally
			{
				XML.ignoreWhitespace = saveXMLIgnoreWhitespace;
				XML.prettyPrinting = saveXMLPrettyPrinting;
			}
			
			rootNamespace = xml.namespace();
			
			ns = xml.namespace();
			ttm = xml.namespace("ttm");
			tts = xml.namespace("tts");
			
			try 
			{
				parseHead(document, xml);
				parseBody(document, xml);		
			}
			catch (err:Error) 
			{
				debugLog("Unhandled exception in DFXPParser : "+err.message);
				throw err;
			}
			
			return document;
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
				// Catch only this one: "Error #1080: Illegal value for namespace." This
				// means the document is missing some of the metadata tags we tried to
				// access, not a fatal error.
				if (err.errorID != 1080) 
				{
					throw err;
				}
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
				var divTags:XMLList = xml..ns::div;
			   if (divTags.length() < 1)
			   {
				 // todo: make this more clear, if a user were to see it what would they say?
				 throw new Error("must have at least one div element");
			   }
				
			   for each (var divNode:XML in divTags)
			   {	
			     var divLang:String = divNode.@xmlNamespace::lang ;
				 _availableLanguage.push(divLang);
				 // if there is begin attribute for the div tag, that is an unsupported div Node for us, ignore it.
				 if (divNode["@begin"].length >= 1) { continue; }
				 _captionsObject[divLang] = (parseDivNode(divNode,doc));
	             doc.addCaptionsArray(_captionsObject, _numOfCaption, _availableLanguage);
		       }
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
					if(i == 0 || _captions[_captions.length-1].start != caption.start)
					{
						_captions.push(caption);
					}
					else if(_captions[_captions.length-1].start == caption.start) 
					{
						var firstCaption:Caption = _captions[_captions.length-1];
						_captions[_captions.length-1].text = firstCaption.text + "\n" + caption.text;
						// update the endTime to longest if actually defined
						if(!isNaN(firstCaption.end) && !isNaN(caption.end))
						{
							_captions[_captions.length-1].end = Math.max(firstCaption.end, caption.end);
						}
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
			var beginSecs:Number = TimeUtil.parseTime(begin);
			
			var endSecs:Number = 0;
			
			// If we found both 'end' and 'dur', ignore 'dur'
			if (end != "") 
			{
				endSecs = TimeUtil.parseTime(end);
			}
			else if (dur != "") 
			{
				endSecs = beginSecs + TimeUtil.parseTime(dur);
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
			return captionItem;
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

		}
		private var xmlNamespace:Namespace;
		private var ns:Namespace;
		private var ttm:Namespace;
		private var tts:Namespace;
		private var rootNamespace:Namespace;
		private var _availableLanguage:Array= new Array();
		private var _captionsObject:Object=new Object();
		private var _captions:Vector.<Caption>;
		private var _numOfCaption:Number;
				
	}
}
