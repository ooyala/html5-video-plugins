package 
{
  import flash.display.Sprite;
  import org.osmf.captioning.CaptioningPluginInfo;
  import org.osmf.media.PluginInfo;
  
  /**
   * The root level object of the Caption Plugin.
   */
  public class CaptioningPlugin extends Sprite
  {  
    private var _pluginInfo:CaptioningPluginInfo;  
    /**
     * Constructor.
     */
    public function CaptioningPlugin()
    {
      _pluginInfo = new CaptioningPluginInfo();
    }
    
    /**
     * Gives the player the PluginInfo.
     */
    public function get pluginInfo():PluginInfo
    {
      return _pluginInfo;
    }
  }
}
