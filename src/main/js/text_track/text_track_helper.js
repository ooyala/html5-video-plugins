import TextTrackMap from "./text_track_map";

/**
 *
 */
export default class TextTrackHelper {

  constructor(video) {
    this.video = video;
  }

  /**
   *
   * @public
   * @param {Object} trackData
   */
  addTrack(trackData) {
    const track = document.createElement('track');
    track.id = trackData.id;
    track.kind = 'subtitles';
    track.label = trackData.label;
    track.srclang = trackData.srclang;
    track.src = trackData.src;
    this.video.appendChild(track);
  }

  /**
   *
   * @private
   * @param {String} trackId
   * @param {String} label
   */
  updateLabel(trackId, label = '') {
    if (this.video && trackId) {
      const trackElement = this.video.querySelector(`#${trackId}`);

      if (trackElement) {
        trackElement.setAttribute('label', label);
      }
    }
  }

  /**
   *
   * @public
   * @param  {type} callback
   */
  forEach(callback) {
    if (!this.video || !this.video.textTracks) {
      return;
    }
    Array.prototype.forEach.call(this.video.textTracks, callback);
  }

  /**
   *
   * @public
   * @param {Function} callback
   * @return {Array}
   */
  filter(callback) {
    if (!this.video || !this.video.textTracks) {
      return [];
    }
    return Array.prototype.filter.call(this.video.textTracks, callback);
  }

  /**
   *
   * @public
   * @param {Function} callback
   * @return {TextTrack}
   */
  find(callback) {
    if (!this.video || !this.video.textTracks) {
      return;
    }
    let track = Array.prototype.find.call(this.video.textTracks, callback);
    return track;
  }

  /**
   *
   * @public
   * @param {String} languageOrId
   * @param {TextTrackMap} textTrackMap
   * @return {TextTrack}
   */
  findTrackByKey(languageOrId, textTrackMap = new TextTrackMap()) {
    let track = this.find(currentTrack => {
      const trackMetadata = textTrackMap.findEntry({
        textTrack: currentTrack
      });
      const matchesTrackId = !!trackMetadata && trackMetadata.id === languageOrId;
      const matchesLanguage = currentTrack.language === languageOrId;
      const keyMatchesTrack = matchesTrackId || matchesLanguage;

      return keyMatchesTrack;
    });
    return track;
  }

  /**
   *
   * @public
   * @param {TextTrackMap} textTrackMap
   * @return {Array}
   */
  filterChangedTracks(textTrackMap = new TextTrackMap()) {
    const changedTracks = this.filter(currentTrack => {
      const trackMetadata = textTrackMap.findEntry({
        textTrack: currentTrack
      });
      const hasTrackChanged = (
        trackMetadata &&
        currentTrack.mode !== trackMetadata.mode
      );

      return hasTrackChanged;
    });
    return changedTracks;
  }

  /**
   *
   * @public
   * @param {TextTrackMap} textTrackMap
   */
  removeExternalTracks(textTrackMap = TextTrackMap()) {
    for (let trackMetadata of textTrackMap.getExternalEntries()) {
      const trackElement = document.getElementById(trackMetadata.id);

      if (trackElement) {
        trackElement.remove();
      }
    }
  }
}
