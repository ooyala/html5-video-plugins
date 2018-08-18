
export default class TextTrackMap {

  constructor(idPrefix = 'textTrack') {
    this.idPrefix = idPrefix;
    this.textTracks = [];
  }

  addEntry(metadata = {}) {
    const newTextTrack = Object.assign({}, metadata);

    newTextTrack.id = `${this.idPrefix}${this.textTracks.length + 1}`;
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

  tryUpdateEntry(searchOptions, metadata = {}) {
    const entry = this.findEntry(searchOptions);

    if (entry) {
      Object.assign(entry, metadata);
    }
  }

  clear() {
    this.textTracks = [];
  };
}
