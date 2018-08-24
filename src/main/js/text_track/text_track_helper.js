import TextTrackMap from "./text_track_map";

export default class TextTrackHelper {

  constructor(video) {
    this.video = video;
  }

  addTrack(trackData) {
    const track = document.createElement('track');
    track.id = trackData.id;
    track.kind = 'subtitles';
    track.label = trackData.label;
    track.srclang = trackData.srclang;
    track.src = trackData.src;
    this.video.appendChild(track);
  }

  forEach(callback) {
    if (!this.video || !this.video.textTracks) {
      return;
    }
    Array.prototype.forEach.call(this.video.textTracks, callback);
  }

  filter(callback) {
    if (!this.video || !this.video.textTracks) {
      return [];
    }
    return Array.prototype.filter.call(this.video.textTracks, callback);
  }

  findTrack(callback) {
    if (!this.video || !this.video.textTracks) {
      return;
    }
    let track = Array.prototype.find.call(this.video.textTracks, callback);
    return track;
  }

  findTrackById(id) {
    let track = this.findTrack(currentTrack =>
      currentTrack.id === id || currentTrack.trackId === id
    );
    return track;
  }

  findTrackByLanguage(language) {
    let track = this.findTrack(currentTrack => {
      const matchesLanguage = currentTrack.language === language && !currentTrack.trackId;
      const matchesTrackIdLanguage = currentTrack.trackId === language;

      return matchesLanguage || matchesTrackIdLanguage;
    });
    return track;
  }

  getInternalTracks(textTrackMap = new TextTrackMap()) {
    const internalTracks = this.filter(currentTrack => {
      const isInternal = !textTrackMap.existsEntry({
        id: currentTrack.id,
        isExternal: true
      });
      const isText = (
        currentTrack.kind === 'captions' || currentTrack.kind === 'subtitles'
      );
      return isInternal && isText;
    });
    return internalTracks;
  }

  getExternalTracks(textTrackMap = new TextTrackMap()) {
    const externalTracks = this.filter(currentTrack =>
      textTrackMap.existsEntry({
        id: currentTrack.id,
        isExternal: true
      })
    );
    return externalTracks;
  }

  removeExternalTracks(textTrackMap = TextTrackMap()) {
    for (let trackMetadata of textTrackMap.getExternalEntries()) {
      const trackElement = document.getElementById(trackMetadata.id);

      if (trackElement) {
        trackElement.remove();
      }
    }
  }
}
