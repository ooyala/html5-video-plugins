import TextTrackMap from "../../../../src/main/js/text_track/text_track_map";

describe('TextTrackMap', function() {
  let textTrackMap;

  beforeEach(function() {
    textTrackMap = new TextTrackMap();
  });

  it('should create a TextTrackMap instance', function() {
    expect(textTrackMap).to.be.ok();
    expect(textTrackMap.textTracks).to.eql([]);
  });

  describe('addEntry', function() {

    it('should add an external track entry and auto-generate id', function() {
      const isExternal = true;
      textTrackMap.addEntry({ data: 'data' }, isExternal);
      expect(textTrackMap.textTracks.length).to.be(1);
      expect(textTrackMap.textTracks[0]).to.eql({
        id: 'VTT1',
        data: 'data',
        isExternal: true
      });
    });

    it('should add an internal track entry and auto-generate id', function() {
      const isExternal = false;
      textTrackMap.addEntry({ data: 'data' }, isExternal);
      expect(textTrackMap.textTracks.length).to.be(1);
      expect(textTrackMap.textTracks[0]).to.eql({
        id: 'CC1',
        data: 'data',
        isExternal: false
      });
    });

    it('should generate sequential ids', function() {
      let isExternal = false;
      textTrackMap.addEntry({ data: 'data1' }, isExternal);
      textTrackMap.addEntry({ data: 'data2' }, isExternal);
      isExternal = true;
      textTrackMap.addEntry({ data: 'data3' }, true);
      textTrackMap.addEntry({ data: 'data4' }, true);
      expect(textTrackMap.textTracks.length).to.be(4);
      expect(textTrackMap.textTracks).to.eql([{
        id: 'CC1',
        data: 'data1',
        isExternal: false
      }, {
        id: 'CC2',
        data: 'data2',
        isExternal: false
      }, {
        id: 'VTT1',
        data: 'data3',
        isExternal: true
      }, {
        id: 'VTT2',
        data: 'data4',
        isExternal: true
      }]);
    });

    it('should override values of properties that are used internally', function() {
      let isExternal = true;
      textTrackMap.addEntry({
        id: 'noodles',
        data: 'data1',
        isExternal: 'maybe'
      }, isExternal);
      expect(textTrackMap.textTracks[0]).to.eql({
        id: 'VTT1',
        data: 'data1',
        isExternal: true
      });
    });
  });

  describe('findEntry', function() {

    it('should return undefined when there are no matches', function() {
      expect(textTrackMap.findEntry()).to.be(undefined);
    });

    it('should return the entry that matches searchOptions', function() {
      let isExternal = false;
      textTrackMap.addEntry({ data: 'data1' }, isExternal);
      textTrackMap.addEntry({ data: 'data2' }, isExternal);
      expect(textTrackMap.findEntry({ data: 'data2' })).to.be(textTrackMap.textTracks[1]);
    });

    it('should not match an entry unless all searchOptions are matched', function() {
      let isExternal = false;
      textTrackMap.addEntry({ data: 'data1' }, isExternal);
      textTrackMap.addEntry({ data: 'data2' }, isExternal);
      expect(textTrackMap.findEntry({ data: 'data2', rando: 2 })).to.be(undefined);
    });

    it('should match all search options', function() {
      let isExternal = false;
      textTrackMap.addEntry({ data: 'data1' }, isExternal);
      textTrackMap.addEntry({ data: 'data2', prop: 'prop1' }, isExternal);
      textTrackMap.addEntry({ data: 'data3' }, isExternal);
      expect(textTrackMap.findEntry({
        data: 'data2',
        prop: 'prop1'
      })).to.be(textTrackMap.textTracks[1]);
    });
  });

  describe('existsEntry', function() {

    it('should return true when entry exists', function() {
      let isExternal = false;
      textTrackMap.addEntry({ data: 'data1' }, isExternal);
      expect(textTrackMap.existsEntry({
        id: 'CC1',
      })).to.be(true);
    });

    it('should return false when entry doesn\'t exist', function() {
      expect(textTrackMap.existsEntry({
        id: 'CC1',
      })).to.be(false);
    });
  });

  describe('tryUpdateEntry', function() {

    it('should update entry if found', function() {
      let isExternal = false;
      textTrackMap.addEntry({ data: 'data1' }, isExternal);
      textTrackMap.tryUpdateEntry({
        id: 'CC1'
      }, {
        data: 'updatedData',
        newData: 'newData1'
      });
      expect(textTrackMap.textTracks[0]).to.eql({
        id: 'CC1',
        data: 'updatedData',
        newData: 'newData1',
        isExternal: false
      });
    });
  });

  describe('getInternalEntries', function() {

    it('should return all internal entries', function() {
      textTrackMap.addEntry({ data: 'data1' }, false);
      textTrackMap.addEntry({ data: 'data2' }, true);
      textTrackMap.addEntry({ data: 'data3' }, false);
      expect(textTrackMap.getInternalEntries()).to.eql([
        textTrackMap.textTracks[0],
        textTrackMap.textTracks[2],
      ]);
    });
  });

  describe('getExternalEntries', function() {

    it('should return all external entries', function() {
      textTrackMap.addEntry({ data: 'data1' }, true);
      textTrackMap.addEntry({ data: 'data2' }, false);
      textTrackMap.addEntry({ data: 'data3' }, true);
      expect(textTrackMap.getExternalEntries()).to.eql([
        textTrackMap.textTracks[0],
        textTrackMap.textTracks[2],
      ]);
    });
  });

  describe('areAllDisabled', function() {

    it('should return true when all tracks are disabled', function() {
      textTrackMap.addEntry({ mode: 'disabled' }, true);
      textTrackMap.addEntry({ mode: 'disabled' }, false);
      textTrackMap.addEntry({ mode: 'disabled' }, true);
      expect(textTrackMap.areAllDisabled()).to.be(true);
    });

    it('should return false when not all tracks are disabled', function() {
      textTrackMap.addEntry({ mode: 'disabled' }, true);
      textTrackMap.addEntry({ mode: 'showing' }, false);
      textTrackMap.addEntry({ mode: 'disabled' }, true);
      expect(textTrackMap.areAllDisabled()).to.be(false);
    });
  });

  describe('clear', function() {

    it('should clear all entries', function() {
      textTrackMap.addEntry({ mode: 'disabled' }, true);
      textTrackMap.addEntry({ mode: 'showing' }, false);
      textTrackMap.addEntry({ mode: 'disabled' }, true);
      expect(textTrackMap.textTracks.length).to.be(3);
      textTrackMap.clear();
      expect(textTrackMap.textTracks.length).to.be(0);
    });

    it('should restart id sequence after clearing', function() {
      textTrackMap.addEntry({ mode: 'disabled' }, true);
      textTrackMap.addEntry({ mode: 'showing' }, false);
      textTrackMap.clear();
      textTrackMap.addEntry({ mode: 'disabled' }, true);
      textTrackMap.addEntry({ mode: 'showing' }, false);
      expect(textTrackMap.textTracks[0].id).to.be('VTT1');
      expect(textTrackMap.textTracks[1].id).to.be('CC1');
    });
  });
});
