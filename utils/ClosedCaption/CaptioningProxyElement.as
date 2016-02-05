package 
{
	import org.osmf.elements.ProxyElement;
	import org.osmf.events.LoadEvent;
	import org.osmf.events.MediaError;
	import org.osmf.events.MediaErrorEvent;
	import org.osmf.media.MediaElement;
	import org.osmf.media.MediaResourceBase;
	import org.osmf.media.URLResource;
	import org.osmf.metadata.Metadata;
	import org.osmf.metadata.TimelineMetadata;
	import org.osmf.net.StreamingURLResource;
	import org.osmf.traits.LoadState;
	import org.osmf.traits.LoadTrait;
	import org.osmf.traits.MediaTraitType;

	/**
	 * The CaptioningProxyElement class is a wrapper for the media supplied.
	 * It's purpose is to override the loadable trait to allow the retrieval and
	 * processing of an Timed Text file used for captioning.
	 */
	public class CaptioningProxyElement extends ProxyElement
	{
		/**
		 * Constant for the MediaError that is triggered when the proxiedElement
		 * is invalid (e.g. doesn't have the captioning metadata).
		 **/ 
		public static const MEDIA_ERROR_INVALID_PROXIED_ELEMENT:int = 2201;
		
		private static const ERROR_MISSING_CAPTION_METADATA:String = "Media Element is missing Captioning metadata";
		private static const ERROR_MISSING_RESOURCE:String = "Media Element is missing a valid resource";
		
		private var _loadTrait:CaptioningLoadTrait;
		private var _continueLoadOnFailure:Boolean;
		
		/**
		 * Constructor.
		 * 
		 * @inheritDoc
		 * 
		 * @param continueLoadOnFailure Specifies whether or not the 
		 * class should continue the load process if the captioning
		 * document fails to load. The default value is <code>true</code>.
		 */
		public function CaptioningProxyElement(proxiedElement:MediaElement=null, continueLoadOnFailure:Boolean=true)
		{
			super(proxiedElement);
			
			_continueLoadOnFailure = continueLoadOnFailure;
		}
		
		/**
		 * Specifies whether or not this class should continue loading
		 * the media element when the captioning document
		 * fails to load.
		 */
		public function get continueLoadOnFailure():Boolean
		{
			return _continueLoadOnFailure;
		}
				
		/**
		 * @private
		 */
		override public function set proxiedElement(value:MediaElement):void
		{
			super.proxiedElement = value;
			
			if (value != null)
			{
				// Override the LoadTrait with our own custom LoadTrait,
				// which retrieves the Timed Text document, parses it, and sets up
				// the object model representing the caption data.
				
				// Get the Timed Text url resource from the metadata of the element
				// that is wrapped.
				var mediaElement:MediaElement = super.proxiedElement;
				var tempResource:MediaResourceBase = (mediaElement && mediaElement.resource != null) ? mediaElement.resource : resource;
				if (tempResource == null)
				{
					dispatchEvent(new MediaErrorEvent( MediaErrorEvent.MEDIA_ERROR, false, false, 
									new MediaError(MEDIA_ERROR_INVALID_PROXIED_ELEMENT)));
				}
				else
				{
					var metadata:Metadata = tempResource.getMetadataValue(CaptioningPluginInfo.CAPTIONING_METADATA_NAMESPACE) as Metadata;
					if (metadata == null)
					{
						if (!_continueLoadOnFailure)
						{
							dispatchEvent(new MediaErrorEvent( MediaErrorEvent.MEDIA_ERROR, false, false, 
											new MediaError(MEDIA_ERROR_INVALID_PROXIED_ELEMENT)));
						}
					}
					else
					{		
						var timedTextURL:String = metadata.getValue(CaptioningPluginInfo.CAPTIONING_METADATA_KEY_URI);
						if (timedTextURL != null)
						{
							_loadTrait = new CaptioningLoadTrait(new CaptioningLoader(), new URLResource(timedTextURL));
							
							_loadTrait.addEventListener(LoadEvent.LOAD_STATE_CHANGE, onLoadStateChange, false, 99);
							addTrait(MediaTraitType.LOAD, _loadTrait);
						}
						else if (!_continueLoadOnFailure)
						{
							dispatchEvent(new MediaErrorEvent( MediaErrorEvent.MEDIA_ERROR, false, false, 
											new MediaError(MEDIA_ERROR_INVALID_PROXIED_ELEMENT)));
						}
					}
				}
			}
		}
		
		private function onLoadStateChange(event:LoadEvent):void
		{
			if (event.loadState == LoadState.READY)
			{
				var document:CaptioningDocument = _loadTrait.document;
				var mediaElement:MediaElement = super.proxiedElement;
				
				// Create a TimelineMetadata object to associate the captions with
				// the media element.
				var captionMetadata:TimelineMetadata = proxiedElement.getMetadata(CaptioningPluginInfo.CAPTIONING_TEMPORAL_METADATA_NAMESPACE) as TimelineMetadata;
				if (captionMetadata == null)
				{
					captionMetadata = new TimelineMetadata(proxiedElement);
					proxiedElement.addMetadata(CaptioningPluginInfo.CAPTIONING_TEMPORAL_METADATA_NAMESPACE, captionMetadata);
				}
				
				for (var i:int = 0; i < document.numCaptions; i++)
				{
					var caption:Caption = document.getCaptionAt(i);
					
					// Check for sub-clipping
					if (mediaElement != null && mediaElement.resource is StreamingURLResource)
					{
						var res:StreamingURLResource = StreamingURLResource(mediaElement.resource);
					}
					
					// Check for valid time since we adjusted for sub-clipping
					if (caption.time >= 0)
					{
						captionMetadata.addMarker(caption);
					}
				}

				cleanUp();
			}
			else if (event.loadState == LoadState.LOAD_ERROR)
			{
				if (!_continueLoadOnFailure)
				{
					dispatchEvent(event.clone());
				}
				else
				{
					cleanUp();
				}
			}
		}
		
		private function cleanUp():void
		{
			_loadTrait.removeEventListener(LoadEvent.LOAD_STATE_CHANGE, onLoadStateChange);
			// Our work is done, remove the custom LoadTrait.  This will
			// expose the base LoadTrait, which we can then use to do
			// the actual load.
			removeTrait(MediaTraitType.LOAD);
			var loadTrait:LoadTrait = getTrait(MediaTraitType.LOAD) as LoadTrait;
			if (loadTrait != null && loadTrait.loadState == LoadState.UNINITIALIZED)
			{
				loadTrait.load();
			}
		}
	}
}
