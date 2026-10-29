import { BLOCK_TYPES } from '../../../constants';
import createMediaNode from './createMediaNode';
import FileBlockView from './views/FileBlockView';

const FileBlock = createMediaNode({
  name: BLOCK_TYPES.FILE,
  dataType: 'file-block',
  commandName: 'setFileBlock',
  defaults: { fileId: null, fileName: '', mimeType: '', size: 0 },
  view: FileBlockView,
});

export default FileBlock;
