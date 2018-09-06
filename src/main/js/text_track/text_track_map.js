import CONSTANTS from "../constants/constants";

/**
 * Allows us to store and associate metadata with a TextTrack object since we
 * can't store any data on the object itself. Automatically generates an id for
 * registered tracks which can be used identify the object later.
 */
export default class TextTrackMap {

  constructor() {
    this.textTracks = [];
  }

  /**
   * Creates an entry in the TextTrackMap which represents a TextTrack object that
   * has been added to or found in the video element. Automatically generates an id
   * that can be used to identify the TextTrack later on.
   * @public
   * @param {Object} metadata An object with metadata related to a TextTrack
   * @param {Boolean} isExternal Determines whether or not the TextTrack was added by the plugin (i.e. is external)
   * @return {String} The auto-generated id assigned to the newly registered track
   */
  addEntry(metadata = {}, isExternal = false) {
    let idPrefix, trackCount;

    if (isExternal) {
      idPrefix = CONSTANTS.ID_PREFIX.EXTERNAL;
      trackCount = this.getExternalEntries().length;
    } else {
      idPrefix = CONSTANTS.ID_PREFIX.INTERNAL;
      trackCount = this.getInternalEntries().length;
    }
    // Generate new id based on the track count for the given track type
    // (i.e. internal vs external)
    const newTextTrack = Object.assign({}, metadata, {
      id: `${idPrefix}${trackCount + 1}`,
      isExternal: !!isExternal
    });

    this.textTracks.push(newTextTrack);
    return newTextTrack.id;
  }

  /**
   * Finds the metadata that matches the given search options.
   * @public
   * @param {Object} searchOptions An object whose key value pairs will be matched against
   * the existing entries. All existing properties in searchOptions need to match in order
   * for a given entry to be matched.
   * @return {Object} The metadata object that matches the given search options or undefined if there are no matches.
   */
  findEntry(searchOptions = {}) {
    const textTrack = this.textTracks.find(currentTrack => {
      let isFound = true;

      for (let property in searchOptions) {
        if (searchOptions[property] !== currentTrack[property]) {
          isFound = false;
          break;
        }
      }
      return isFound;
    });
    return textTrack;
  };

  /**
   * Determines whether or not there exists an entry that matches the given search options.
   * @public
   * @param {Object} searchOptions An object whose key value pairs will be matched against
   * the existing entries. All existing properties in searchOptions need to match in order
   * for a given entry to be matched.
   * @return {Boolean} True if the entry exists, false otherwise
   */
  existsEntry(searchOptions) {
    const exists = !!this.findEntry(searchOptions);
    return exists;
  }

  /**
   * Finds an entry with the given search options and merges the provided metadata
   * with the existing object/
   * @public
   * @param {Object} searchOptions An object whose key value pairs will be matched against
   * the existing entries. All existing properties in searchOptions need to match in order
   * for a given entry to be matched.
   * @param {Object} metadata An object containing the properties to be merged with the existing object
   * @return {Object} The updated metadata entry or undefined if there were no matches
   */
  tryUpdateEntry(searchOptions, metadata = {}) {
    let entry = this.findEntry(searchOptions);

    if (entry) {
      entry = Object.assign(entry, metadata);
    }
    return entry;
  }

  /**
   * Gets all of the entries associated with internal in-manifest/in-stream text tracks.
   * @public
   * @return {Array} An array with all the internal TextTrack objects.
   */
  getInternalEntries() {
    const internalEntries = this.textTracks.filter(trackMetadata =>
      !trackMetadata.isExternal
    );
    return internalEntries;
  }

  /**
   * Gets all of the entries associated with external, manually added text tracks.
   * @public
   * @return {Array} An array with all the external TextTrack objects.
   */
  getExternalEntries() {
    const externalEntries = this.textTracks.filter(trackMetadata =>
      trackMetadata.isExternal
    );
    return externalEntries;
  }

  /**
   * Determines whether or not all of the track entries are currently in 'disabled' mode.
   * @public
   * @return {Boolean} True if all tracks have 'disabled' mode, false otherwise
   */
  areAllDisabled() {
    const allDisabled = this.textTracks.reduce((result, trackMetadata) =>
      result && trackMetadata.mode === OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED
    , true);
    return allDisabled;
  }

  /**
   * Clears all the text track metadata and resets id generation.
   * @public
   */
  clear() {
    this.textTracks = [];
  };
}
