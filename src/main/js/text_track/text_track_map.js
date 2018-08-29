
const ID_PREFIX = {
  INTERNAL: 'CC',
  EXTERNAL: 'VTT',
};

/**
 *
 */
export default class TextTrackMap {

  constructor() {
    this.textTracks = [];
  }

  /**
   *
   * @public
   * @param {Object} metadata
   * @param {Boolean} isExternal
   * @return {String}
   */
  addEntry(metadata = {}, isExternal = false) {
    let idPrefix, trackCount;

    if (isExternal) {
      idPrefix = ID_PREFIX.EXTERNAL;
      trackCount = this.getExternalEntries().length;
    } else {
      idPrefix = ID_PREFIX.INTERNAL;
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
   *
   * @public
   * @param {Object} searchOptions
   * @return {Object}
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
   *
   * @public
   * @param {Object} searchOptions
   * @return {Boolean}
   */
  existsEntry(searchOptions) {
    const exists = !!this.findEntry(searchOptions);
    return exists;
  }

  /**
   *
   * @public
   * @param {Object} searchOptions
   * @param {Object} metadata
   * @return {Object}
   */
  tryUpdateEntry(searchOptions, metadata = {}) {
    let entry = this.findEntry(searchOptions);

    if (entry) {
      entry = Object.assign(entry, metadata);
    }
    return entry;
  }

  /**
   *
   * @public
   * @return {Array}
   */
  getInternalEntries() {
    const internalEntries = this.textTracks.filter(trackMetadata =>
      !trackMetadata.isExternal
    );
    return internalEntries;
  }

  /**
   *
   * @public
   * @return {Array}
   */
  getExternalEntries() {
    const externalEntries = this.textTracks.filter(trackMetadata =>
      trackMetadata.isExternal
    );
    return externalEntries;
  }

  /**
   *
   * @public
   */
  clear() {
    this.textTracks = [];
  };
}
