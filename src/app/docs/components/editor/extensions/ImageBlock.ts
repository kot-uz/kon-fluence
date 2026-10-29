import { BLOCK_TYPES } from '../../../constants';
import createMediaNode from './createMediaNode';
import ImageBlockView from './views/ImageBlockView';

const ImageBlock = createMediaNode({
  name: BLOCK_TYPES.IMAGE,
  dataType: 'image-block',
  commandName: 'setImageBlock',
  // width — % ширины колонки; align: left | center | right
  defaults: { fileId: null, fileName: '', alt: '', caption: '', width: 100, align: 'center' },
  view: ImageBlockView,
});

export default ImageBlock;
