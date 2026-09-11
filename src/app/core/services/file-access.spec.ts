import { isAudioFile } from './file-access';

describe('audio file detection', () => {
  it('detects audio by MIME type', () => {
    expect(isAudioFile({ name: 'recording.bin', type: 'audio/mpeg' })).toBeTrue();
  });

  it('detects common audio extensions even without MIME type', () => {
    expect(isAudioFile({ fileName: 'call.MP3' })).toBeTrue();
    expect(isAudioFile({ originalName: 'voice.wav' })).toBeTrue();
    expect(isAudioFile({ name: 'meeting.flac' })).toBeTrue();
  });

  it('does not classify normal documents as audio', () => {
    expect(isAudioFile({ name: 'contract.pdf', type: 'application/pdf' })).toBeFalse();
  });
});
