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

  updateLabel(trackId, label = '') {
    if (this.video && trackId) {
      const trackElement = this.video.querySelector(`#${trackId}`);

      if (trackElement) {
        trackElement.setAttribute('label', label);
      }
    }
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

  findTrackByKey(languageOrId, textTrackMap = new TextTrackMap()) {
    let track = this.findTrack(currentTrack => {
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

  getInternalTracks(textTrackMap = new TextTrackMap()) {
    const internalTracks = this.filter(currentTrack => {
      const isInternal = !textTrackMap.existsEntry({
        textTrack: currentTrack,
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
        textTrack: currentTrack,
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
