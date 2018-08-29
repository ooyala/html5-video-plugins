import TextTracks from "./text_tracks";
import TextTrackMap from "./text_track_map";

export default class TextTrackHelper {

  constructor(video) {
    this.video = video;
    this.textTracks = new TextTracks(video);
    this.textTrackMap = new TextTrackMap();
  }

  /**
   *
   * @private
   * @method TextTrackHelper#addExternalVttCaptions
   * @param {object} vttClosedCaptions
   * @param {string} targetLanguage
   * @param {string} targetMode
   * @return {boolean}
   */
  addExternalVttCaptions(vttClosedCaptions = {}, targetLanguage, targetMode) {
    let wasTargetTrackAdded = false;

    for (let language in vttClosedCaptions) {
      const trackData = Object.assign(
        { language: language },
        vttClosedCaptions[language]
      );
      const existsTrack = this.textTrackMap.existsEntry({
        src: trackData.url
      });

      if (!existsTrack) {
        this.addExternalCaptionsTrack(trackData, targetLanguage, targetMode);

        if (language === targetLanguage) {
          wasTargetTrackAdded = true;
        }
      }
    }
    return wasTargetTrackAdded;
  }

  /**
   *
   * @private
   * @method TextTrackHelper#addExternalCaptionsTrack
   * @param {object} trackData
   * @param {string} targetLanguage
   * @param {string} targetMode
   */
  addExternalCaptionsTrack(trackData = {}, targetLanguage, targetMode) {
    let trackMode;

    if (trackData.language === targetLanguage) {
      trackMode = targetMode;
    } else {
      trackMode = OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED;
    }

    const trackId = this.textTrackMap.addEntry({
      src: trackData.url,
      label: trackData.name,
      mode: trackMode
    }, true);

    this.textTracks.addTrack({
      id: trackId,
      label: trackId,
      srclang: trackData.language,
      src: trackData.url
    });
  }

  /**
   *
   * @private
   * @method TextTrackHelper#findAndSetTrackMode
   */
  findAndSetTrackMode(languageOrId, trackMode) {
    const targetTrack = this.textTracks.findTrackByKey(languageOrId, this.textTrackMap);
    this.setTextTrackMode(targetTrack, trackMode);
  }

  /**
   *
   * @private
   * @method TextTrackHelper#setTextTrackMode
   * @param {TextTrack} textTrack
   * @param {string} mode
   */
  setTextTrackMode(textTrack, mode) {
    if (textTrack && textTrack.mode !== mode) {
      textTrack.mode = mode;

      this.textTrackMap.tryUpdateEntry({ textTrack: textTrack }, { mode: mode });

      if (mode === OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED) {
        textTrack.oncuechange = null;
      } else {
        textTrack.oncuechange = this.onClosedCaptionCueChange;
      }
      OO.log('>>>>MainHtml5: Text track mode set:', textTrack.language, mode);
    }
  }

  /**
   *
   * @private
   * @method TextTrackHelper#tryMapTracks
   */
  tryMapTracks() {
    this.textTracks.forEach(textTrack => {
      this.mapTrackIfUnknown(textTrack);

      const trackMetadata = this.textTrackMap.findEntry({
        id: textTrack.label
      });

      if (trackMetadata) {
        this.textTrackMap.tryUpdateEntry({ id: trackMetadata.id }, { textTrack: textTrack });
        this.textTracks.updateLabel(trackMetadata.id, trackMetadata.label);

        OO.log(">>>>MainHtml5: Registering newly added text track:", trackMetadata.id);
        this.setTextTrackMode(textTrack, trackMetadata.mode);
      }
    });
  }

  /**
   *
   * @private
   * @method TextTrackHelper#mapTrackIfUnknown
   */
  mapTrackIfUnknown(textTrack) {
    const isKnownTrack = this.textTrackMap.existsEntry({
      textTrack: textTrack
    });

    if (!isKnownTrack) {
      this.textTrackMap.addEntry({
        textTrack: textTrack,
        mode: textTrack.mode || OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED
      });
    }
  }

  /**
   *
   * @private
   * @method TextTrackHelper#checkForAvailableClosedCaptions
   */
  checkForAvailableClosedCaptions() {
    const closedCaptionInfo = {
      languages: [],
      locale: {}
    };

    const externalTracks = this.textTracks.getExternalTracks(this.textTrackMap);
    const internalTracks = this.textTracks.getInternalTracks(this.textTrackMap);

    for (let externalTrack of externalTracks) {
      closedCaptionInfo.languages.push(externalTrack.language);
      closedCaptionInfo.locale[externalTrack.language] = externalTrack.label;
    }

    for (let internalTrack of internalTracks) {
      const trackMetadata = this.textTrackMap.findEntry({ textTrack: internalTrack });
      const isLanguageDefined = !!closedCaptionInfo.locale[internalTrack.language];

      if (!isLanguageDefined) {
        const key = (trackMetadata || {}).id;
        const label = (
          internalTrack.label ||
          internalTrack.language ||
          `Captions (${key})`
        );
        closedCaptionInfo.languages.push(key);
        closedCaptionInfo.locale[key] = label;
      }
    }
    return closedCaptionInfo;
  };

  /**
   *
   * @private
   * @method TextTrackHelper#detectTextTrackChange
   */
  detectTextTrackChange() {
    let newLanguage = null;
    let nativeChangesDetected = false;
    let allChangedTracksDisabled = true;

    this.textTracks.forEach(textTrack => {
      const trackMetadata = this.textTrackMap.findEntry({ textTrack: textTrack });

      if (
        trackMetadata &&
        textTrack.mode !== trackMetadata.mode
      ) {
        if (this.hasStartedPlaying) {
          nativeChangesDetected = true;
          this.textTrackMap.tryUpdateEntry({ id: trackMetadata.id }, { mode: textTrack.mode });

          if (textTrack.mode !== OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED) {
            allChangedTracksDisabled = false;
            newLanguage = trackMetadata.isInternal ? textTrack.language : trackMetadata.id;
          }
        } else {
          textTrack.mode = trackMetadata.mode;
          OO.log('>>>>MainHtml5: Default browser CC language detected, ignoring in favor of user-specified language');
        }
      }
    });

    if (nativeChangesDetected && allChangedTracksDisabled) {
      newLanguage = 'none';
    }
    return newLanguage;
  }

  /**
   *
   * @private
   * @method TextTrackHelper#reset
   */
  reset() {
    this.hasStartedPlaying = false;
    this.textTracks.removeExternalTracks(this.textTrackMap);
    this.textTrackMap.clear();
  }
}
