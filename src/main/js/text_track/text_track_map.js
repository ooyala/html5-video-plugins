
const ID_PREFIX = {
  INTERNAL: 'CC',
  EXTERNAL: 'VTT',
};

export default class TextTrackMap {

  constructor() {
    this.textTracks = [];
  }

  addEntry(metadata = {}, isExternal = false) {
    let idPrefix, trackCount;

    if (isExternal) {
      idPrefix = ID_PREFIX.EXTERNAL;
      trackCount = this.getExternalEntries().length;
    } else {
      idPrefix = ID_PREFIX.INTERNAL;
      trackCount = this.getInternalEntries().length;
    }

    const newTextTrack = Object.assign({}, metadata, {
      isExternal: !!isExternal
    });

    newTextTrack.id = `${idPrefix}${trackCount + 1}`;
    this.textTracks.push(newTextTrack);
    return newTextTrack.id;
  }

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

  existsEntry(searchOptions) {
    const exists = !!this.findEntry(searchOptions);
    return exists;
  }

  tryUpdateEntry(searchOptions, metadata = {}) {
    const entry = this.findEntry(searchOptions);

    if (entry) {
      Object.assign(entry, metadata);
    }
  }

  getInternalEntries() {
    const internalEntries = this.textTracks.filter(trackMetadata =>
      !trackMetadata.isExternal
    );
    return internalEntries;
  }

  getExternalEntries() {
    const externalEntries = this.textTracks.filter(trackMetadata =>
      trackMetadata.isExternal
    );
    return externalEntries;
  }

  clear() {
    this.textTracks = [];
  };
}
