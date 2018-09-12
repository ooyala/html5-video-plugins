import TextTrackHelper from "../../../../src/main/js/text_track/text_track_helper";
import TextTrackMap from "../../../../src/main/js/text_track/text_track_map";

describe('TextTrackHelper', function() {
  let textTrackHelper, textTrackMap;

  const getDummyTrackData = (overrides = {}) => {
    return {
      id: overrides.id || `id-${Date.now()}`,
      kind: overrides.kind || 'kind',
      label: overrides.label || 'label',
      srclang: overrides.srclang || 'srclang',
      src: overrides.src || 'src'
    };
  };

  const mapTracks = (isExternal = false) => {
    for (let textTrack of textTrackHelper.video.textTracks) {
      const hasBeenMaped = textTrackMap.existsEntry({
        textTrack: textTrack
      });

      if (!hasBeenMaped) {
        textTrackMap.addEntry({
          label: textTrack.label,
          language: textTrack.language,
          mode: textTrack.mode,
          textTrack: textTrack
        }, isExternal);
      }
    }
  };

  beforeEach(function() {
    textTrackHelper = new TextTrackHelper(document.createElement('video'));
    textTrackMap = new TextTrackMap();
  });

  it('should create a TextTrackHelper instance', function() {
    expect(textTrackHelper).to.be.ok();
  });

  describe('addTrack', function() {

    it('should create a track element with the specified attributes', function() {
      textTrackHelper.addTrack({
        id: 'id',
        kind: 'kind',
        label: 'label',
        srclang: 'srclang',
        src: 'src'
      });
      const trackElement = textTrackHelper.video.querySelector('track');
      expect(trackElement.getAttribute('id')).to.be('id');
      expect(trackElement.getAttribute('kind')).to.be('kind');
      expect(trackElement.getAttribute('label')).to.be('label');
      expect(trackElement.getAttribute('srclang')).to.be('srclang');
      expect(trackElement.getAttribute('src')).to.be('src');
    });
  });

  describe('updateTrackLabel', function() {

    it('should update the label of the matching track element', function() {
      const id = 'id1';
      textTrackHelper.addTrack(getDummyTrackData({
        id: id,
        label: 'label'
      }));
      const trackElement = textTrackHelper.video.querySelector(`#${id}`);
      expect(trackElement.getAttribute('label')).to.be('label');
      textTrackHelper.updateTrackLabel(id, 'marlonrando');
      expect(trackElement.getAttribute('label')).to.be('marlonrando');
    });
  });

  describe('forEach', function() {

    it('should execute a call back for each text track on the video element', function() {
      let callCount = 0;
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.forEach(() => callCount++);
      expect(callCount).to.be(4);
    });
  });

  describe('filter', function() {

    it('should return the elements that match the search criteria', function() {
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData({ id: 'match1', label: 'match' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'match2', label: 'match' }));
      textTrackHelper.addTrack(getDummyTrackData());
      const result = textTrackHelper.filter(track => track.label === 'match');
      expect(result.length).to.be(2);
      expect(result[0].id).to.be('match1');
      expect(result[1].id).to.be('match2');
    });

    it('should return an empty array if no matches are found', function() {
      const result = textTrackHelper.filter(track => track.label === 'match');
      expect(result).to.eql([]);
    });
  });

  describe('find', function() {

    it('should return the first track to match the search criteria', function() {
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData({ id: 'match1', label: 'match' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'match2', label: 'match' }));
      textTrackHelper.addTrack(getDummyTrackData());
      const result = textTrackHelper.find(track => track.label === 'match');
      expect(result.id).to.be('match1');
    });

    it('should return undefined if no matches are found', function() {
      const result = textTrackHelper.find(track => track.label === 'match');
      expect(result).to.be(undefined);
    });
  });

  describe('findTrackByKey', function() {

    it('should return the first external track that matches the language', function() {
      let isExternal;
      textTrackHelper.addTrack(getDummyTrackData({ id: 'CC1' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'CC2' }));
      isExternal = false;
      mapTracks(isExternal);
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT1', srclang: 'es' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT2', srclang: 'en' }));
      isExternal = true;
      mapTracks(isExternal);
      const result = textTrackHelper.findTrackByKey('en', textTrackMap);
      expect(result.id).to.be('VTT2');
    });

    it('should return the first internal track that matches the track id', function() {
      let isExternal;
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT1' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT2' }));
      isExternal = true;
      mapTracks(isExternal);
      textTrackHelper.addTrack(getDummyTrackData({ id: 'CC1', srclang: 'es' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'CC2', srclang: 'en' }));
      isExternal = false;
      mapTracks(isExternal);
      const result = textTrackHelper.findTrackByKey('CC2', textTrackMap);
      expect(result.id).to.be('CC2');
    });

    it('should ignore external tracks that match the track id', function() {
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT1', srclang: 'es' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT2', srclang: 'en' }));
      let isExternal = true;
      mapTracks(isExternal);
      const result = textTrackHelper.findTrackByKey('VTT2', textTrackMap);
      expect(result).to.be(undefined);
    });

    it('should ignore internal tracks that match the language', function() {
      let isExternal;
      textTrackHelper.addTrack(getDummyTrackData({ id: 'CC1', srclang: 'en' }));
      isExternal = false;
      mapTracks(isExternal);
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT1', srclang: 'en' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT2', srclang: 'es' }));
      isExternal = true;
      mapTracks(isExternal);
      const result = textTrackHelper.findTrackByKey('en', textTrackMap);
      expect(result.id).to.be('VTT1');
    });
  });

  describe('filterChangedTracks', function() {

    it('should return all tracks that have a mode that differs from the one stored in the TextTrackMap', function() {
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      mapTracks();
      textTrackHelper.video.textTracks[1].mode = 'showing';
      textTrackHelper.video.textTracks[2].mode = 'showing';
      const result = textTrackHelper.filterChangedTracks(textTrackMap);
      expect(result.length).to.be(2);
      expect(result).to.eql([
        textTrackHelper.video.textTracks[1],
        textTrackHelper.video.textTracks[2]
      ]);
    });

    it('should return an empty array if no tracks have been changed', function() {
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      textTrackHelper.addTrack(getDummyTrackData());
      mapTracks();
      const result = textTrackHelper.filterChangedTracks(textTrackMap);
      expect(result.length).to.be(0);
      expect(result).to.eql([]);
    });
  });

  describe('removeExternalTracks', function() {

    it('should remove all tracks marked as isExternal in the given TextTrackMap', function() {
      let isExternal, trackElements;
      textTrackHelper.addTrack(getDummyTrackData({ id: 'CC1' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'CC2' }));
      isExternal = false;
      mapTracks(isExternal);
      // Note: These need to match the ids generated by TextTrackMap
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT1' }));
      textTrackHelper.addTrack(getDummyTrackData({ id: 'VTT2' }));
      isExternal = true;
      mapTracks(isExternal);
      trackElements = textTrackHelper.video.querySelectorAll('track');
      expect(trackElements.length).to.be(4);
      textTrackHelper.removeExternalTracks(textTrackMap);
      trackElements = textTrackHelper.video.querySelectorAll('track');
      expect(trackElements.length).to.be(2);
      expect(trackElements[0].id).to.be('CC1');
      expect(trackElements[1].id).to.be('CC2');
    });
  });
});
