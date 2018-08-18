
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
}
