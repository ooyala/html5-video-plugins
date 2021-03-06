import TextTrackMap from './text_track_map';

/**
 * Extends the functionality of the TextTrackList object in order to simplify
 * adding, searching, updating and removing text tracks.
 */
export default class TextTrackHelper {
  constructor(video) {
    this.video = video;
  }

  /**
   * Creates a new TextTrack object by appending Track element to the video element.
   * @public
   * @param {Object} trackData An object with the relevant properties to set on the text track object.
   */
  addTrack(trackData = {}) {
    if (!this.video) {
      return;
    }
    const track = document.createElement('track');
    track.id = trackData.id;
    track.kind = trackData.kind;
    track.label = trackData.label;
    track.srclang = trackData.srclang;
    track.src = trackData.src;
    this.video.appendChild(track);
  }

  /**
   * Finds a text track by id and sets its label to the given value. This operation
   * is only possible for tracks that were manually added by the plugin.
   * @public
   * @param {String} trackId The dom id of the text track to update
   * @param {String} label The new label to be set on the text track
   */
  updateTrackLabel(trackId, label = '') {
    if (this.video && trackId) {
      const trackElement = this.video.querySelector(`#${trackId}`);

      if (trackElement) {
        trackElement.setAttribute('label', label);
      }
    }
  }

  /**
   * Allows executing Array.prototype.forEach on the video's TextTrackList.
   * @public
   * @param {Function} callback A function to execute for existing text track.
   */
  forEach(callback) {
    if (!this.video || !this.video.textTracks) {
      return;
    }
    Array.prototype.forEach.call(this.video.textTracks, callback);
  }

  /**
   * Allows executing Array.prototype.filter on the video's TextTrackList.
   * @public
   * @param {Function} callback A predicate function to test each element of the array.
   * @returns {Array} An array with all the TextTrack objects that match the filter criteria.
   */
  filter(callback) {
    if (!this.video || !this.video.textTracks) {
      return [];
    }
    return Array.prototype.filter.call(this.video.textTracks, callback);
  }

  /**
   * Allows executing Array.prototype.find on the video's TextTrackList.
   * @public
   * @param {Function} callback A function to execute on each value in the array.
   * @returns {TextTrack} The first TextTrack object that matches the search criteria or undefined if there are no matches.
   */
  find(callback) {
    if (!this.video || !this.video.textTracks) {
      return;
    }
    let track = Array.prototype.find.call(this.video.textTracks, callback);
    return track;
  }

  /**
   * Finds the TextTrack object that matches a key, which can be either the language
   * code of the track or a track id associated with the track on a TextTrackMap.
   * Important:
   * It is assumed that internal tracks are matched by id and external tracks are
   * matched by language. This function will not return internal tracks that match
   * a language key, for example. This limitation is imposed by the fact that the
   * core uses language as key for closed captions. Ideally all tracks should be
   * matched by id.
   * @public
   * @param {String} languageOrId The language or track id of the track we want to find. Note that
   * language matches only internal tracks and track id only external tracks.
   * @param {TextTrackMap} textTrackMap A TextTrackMap that contains metadata for all of the video's TextTrack objects.
   * @returns {TextTrack} The first TextTrack object that matches the given key or undefined if there are no matches.
   */
  findTrackByKey(languageOrId, textTrackMap = new TextTrackMap()) {
    let track = this.find(currentTrack => {
      const trackMetadata = textTrackMap.findEntry({
        textTrack: currentTrack,
      });
      // Note: We don't match tracks that are unknown to us
      const matchesTrackId = (
        !!trackMetadata &&
        !trackMetadata.isExternal && // We use track id as key for internal tracks
        trackMetadata.id === languageOrId
      );
      const matchesLanguage = (
        !!trackMetadata &&
        trackMetadata.isExternal && // We use language as key for external tracks
        currentTrack.language === languageOrId
      );
      const keyMatchesTrack = matchesTrackId || matchesLanguage;

      return keyMatchesTrack;
    });
    return track;
  }

  /**
   * Returns a list with all of the TextTrack objects whose track mode is different
   * from the value stored in the given TextTrackMap.
   * @public
   * @param {TextTrackMap} textTrackMap A TextTrackMap that contains metadata for all of the video's TextTrack objects.
   * @returns {Array} An array with all of the TextTrack objects that match the search
   * criteria or an empty array if there are no matches.
   */
  filterChangedTracks(textTrackMap = new TextTrackMap()) {
    const changedTracks = this.filter(currentTrack => {
      const trackMetadata = textTrackMap.findEntry({
        textTrack: currentTrack,
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
   * Finds and removes any TextTracks that marked as external on the given
   * TextTrackMap.
   * @public
   * @param {TextTrackMap} textTrackMap A TextTrackMap that contains metadata for all of the video's TextTrack objects.
   */
  removeExternalTracks(textTrackMap = TextTrackMap()) {
    if (!this.video) {
      return;
    }

    for (let trackMetadata of textTrackMap.getExternalEntries()) {
      const trackElement = this.video.querySelector(`#${trackMetadata.id}`);

      if (trackElement) {
        trackElement.remove();
      }
    }
  }
}
