package 
{
	import org.osmf.media.MediaResourceBase;
	import org.osmf.traits.LoadTrait;
	import org.osmf.traits.LoaderBase;
	
	public class CaptioningLoadTrait extends LoadTrait
	{
		public function CaptioningLoadTrait(loader:LoaderBase, resource:MediaResourceBase)
		{
			super(loader, resource);
		}

		public function get document():CaptioningDocument
		{
			return _document;
		}
		
		public function set document(value:CaptioningDocument):void
		{
			_document = value;
		}

		private var _document:CaptioningDocument;
	}
}