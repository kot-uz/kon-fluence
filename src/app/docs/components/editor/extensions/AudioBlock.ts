import { BLOCK_TYPES } from '../../../constants';
import createMediaNode from './createMediaNode';
import AudioBlockView from './views/AudioBlockView';

const AudioBlock = createMediaNode({
  name: BLOCK_TYPES.AUDIO,
  dataType: 'audio-block',
  commandName: 'setAudioBlock',
  defaults: { fileId: null, fileName: '', mimeType: '' },
  view: AudioBlockView,
});

export default AudioBlock;
