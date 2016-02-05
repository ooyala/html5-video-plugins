package 
{
	import org.osmf.events.LoaderEvent;
	import org.osmf.events.MediaErrorEvent;
	import org.osmf.media.MediaResourceBase;
	import org.osmf.traits.LoadState;
	import org.osmf.traits.LoadTrait;
	import org.osmf.traits.LoaderBase;
	import org.osmf.utils.HTTPLoadTrait;
	import org.osmf.utils.HTTPLoader;
		
	/**
	 * Loader class for the CaptioningProxyElement.O
	 */
	public class CaptioningLoader extends LoaderBase
	{
		/**
		 * Constructor.
		 * 
		 * @param httpLoader The HTTPLoader to be used by this CaptioningLoader 
		 * to retrieve the Timed Text document. If null, a new one will be 
		 * created.
		 */
		public function CaptioningLoader(httpLoader:HTTPLoader=null)
		{
			super();
			
			this.httpLoader = httpLoader != null ? httpLoader : new HTTPLoader();
		}
		
		/**
		 * @private
		 */
		override public function canHandleResource(resource:MediaResourceBase):Boolean
		{
			return httpLoader.canHandleResource(resource);
		}

		/**
		 * Loads a Timed Text document.
		 * <p>Updates the LoadTrait's <code>loadState</code> property to LOADING
		 * while loading and to READY upon completing a successful load and parse of the
		 * Timed Text document.</p>
		 * 
		 * @see org.osmf.traits.LoadState
		 * @param loadTrait The LoadTrait to be loaded.
		 */
		override protected function executeLoad(loadTrait:LoadTrait):void
		{
			updateLoadTrait(loadTrait, LoadState.LOADING);			
						
			httpLoader.addEventListener(LoaderEvent.LOAD_STATE_CHANGE, onHTTPLoaderStateChange);
			
			// Create a temporary LoadTrait for this purpose, so that our main
			// LoadTrait doesn't reflect any of the state changes from the
			// loading of the URL, and so that we can catch any errors.
			var httpLoadTrait:HTTPLoadTrait = new HTTPLoadTrait(httpLoader, loadTrait.resource);
						
			httpLoadTrait.addEventListener(MediaErrorEvent.MEDIA_ERROR, onLoadError);
			httpLoader.load(httpLoadTrait);

			function onHTTPLoaderStateChange(event:LoaderEvent):void
			{
				if (event.newState == LoadState.READY)
				{
					// This is a terminal state, so remove all listeners.
					httpLoader.removeEventListener(LoaderEvent.LOAD_STATE_CHANGE, onHTTPLoaderStateChange);
					httpLoadTrait.removeEventListener(MediaErrorEvent.MEDIA_ERROR, onLoadError);

					var parser:ICaptioningParser = createCaptioningParser();
					var captioningDocument:CaptioningDocument;
					
					try
					{
						captioningDocument = parser.parse(httpLoadTrait.urlLoader.data.toString());
					}
					catch(e:Error)
					{
						updateLoadTrait(loadTrait, LoadState.LOAD_ERROR);
					}
					
					CaptioningLoadTrait(loadTrait).document = captioningDocument;
					updateLoadTrait(loadTrait, LoadState.READY);
					
				}
				else if (event.newState == LoadState.LOAD_ERROR)
				{
					// This is a terminal state, so remove the listener.  But
					// don't remove the error event listener, as that will be
					// removed when the error event for this failure is
					// dispatched.
					httpLoader.removeEventListener(LoaderEvent.LOAD_STATE_CHANGE, onHTTPLoaderStateChange);
					updateLoadTrait(loadTrait, event.newState);
				}
			}
			
			function onLoadError(event:MediaErrorEvent):void
			{
				// Only remove this listener, as there will be a corresponding
				// event for the load failure.
				httpLoadTrait.removeEventListener(MediaErrorEvent.MEDIA_ERROR, onLoadError);
				
				loadTrait.dispatchEvent(event.clone());
			}						
		}
		
		/**
		 * Unloads the document.  
		 * 
		 * <p>Updates the LoadTrait's <code>loadState</code> property to UNLOADING
		 * while unloading and to CONSTRUCTED upon completing a successful unload.</p>
		 *
		 * @param LoadTrait LoadTrait to be unloaded.
		 * @see org.osmf.traits.LoadState
		 */ 
		override protected function executeUnload(loadTrait:LoadTrait):void
		{
			// Nothing to do.
			updateLoadTrait(loadTrait, LoadState.UNLOADING);			
			updateLoadTrait(loadTrait, LoadState.UNINITIALIZED);
		}
		
		/**
		 * Override to create your own parser.
		 */
		protected function createCaptioningParser():ICaptioningParser
		{
			return new DFXPParser();
		}

		private var httpLoader:HTTPLoader;
		
	}
}
