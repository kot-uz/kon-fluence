import { BLOCK_TYPES } from '../../../constants';
import createMediaNode from './createMediaNode';
import VideoBlockView from './views/VideoBlockView';

const VideoBlock = createMediaNode({
  name: BLOCK_TYPES.VIDEO,
  dataType: 'video-block',
  commandName: 'setVideoBlock',
  defaults: { fileId: null, fileName: '', mimeType: '', caption: '' },
  view: VideoBlockView,
});

export default VideoBlock;
