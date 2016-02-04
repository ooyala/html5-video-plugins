package 
{
	import __AS3__.vec.Vector;
	
	import org.osmf.media.MediaElement;
	import org.osmf.media.MediaFactoryItem;
	import org.osmf.media.MediaFactoryItemType;
	import org.osmf.media.MediaResourceBase;
	import org.osmf.media.PluginInfo;

	/**
	 * Encapsulation of a Captioning plugin.
	 */
	public class CaptioningPluginInfo extends PluginInfo
	{
		// Constants for specifying the Timed Text document URL on the resource metadata
		public static const CAPTIONING_METADATA_NAMESPACE:String = "http://www.osmf.org/captioning/1.0";
		public static const CAPTIONING_METADATA_KEY_URI:String = "uri";
		
		// Constants for the temporal metadata (captions)
		public static const CAPTIONING_TEMPORAL_METADATA_NAMESPACE:String = "http://www.osmf.org/temporal/captioning";
		
		/**
		 * Constructor.
		 */
		public function CaptioningPluginInfo()
		{
			var items:Vector.<MediaFactoryItem> = new Vector.<MediaFactoryItem>();
			
			var item:MediaFactoryItem = new MediaFactoryItem("CaptioningPluginInfo",
													this.canHandleResource,
													createCaptioningProxyElement,
													MediaFactoryItemType.PROXY);
			items.push(item);
			
			super(items);
		}
		
		public function canHandleResource(resource:MediaResourceBase):Boolean
		{
			return (resource != null) ? true : false;
		}
		
		private function createCaptioningProxyElement():MediaElement
		{
			return new CaptioningProxyElement();
		}
	}
}
