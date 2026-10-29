import { BLOCK_TYPES, MAX_FILE_SIZE, MEDIA_EXTENSIONS } from '../constants';
import type { BlockType, MediaBlockType } from '../constants';

export const getExtension = (fileName = '') => {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(index + 1).toLowerCase() : '';
};

const MIME_PREFIXES: Record<MediaBlockType, string> = {
  [BLOCK_TYPES.IMAGE]: 'image/',
  [BLOCK_TYPES.VIDEO]: 'video/',
  [BLOCK_TYPES.AUDIO]: 'audio/',
};

// .ogg бывает и видео, и аудио: решает MIME, без него — аудио
const matchesType = (type: MediaBlockType, mime: string, ext: string) => {
  if (!MEDIA_EXTENSIONS[type].includes(ext)) return false;
  if (mime) return mime.startsWith(MIME_PREFIXES[type]);
  return !(type === BLOCK_TYPES.VIDEO && ext === 'ogg');
};

/**
 * Тип блока для файла: картинка/видео/аудио встраиваются в страницу, остальное — карточка файла.
 * Учитываются и MIME, и расширение: например, SVG и TIFF не показываются как картинки.
 */
export const getBlockTypeByFile = ({ name, type }: Pick<File, 'name' | 'type'>): BlockType => {
  const ext = getExtension(name);
  const mime = (type || '').toLowerCase();
  const mediaTypes: MediaBlockType[] = [BLOCK_TYPES.IMAGE, BLOCK_TYPES.VIDEO, BLOCK_TYPES.AUDIO];
  return mediaTypes.find((blockType) => matchesType(blockType, mime, ext)) || BLOCK_TYPES.FILE;
};

export const isFileTooLarge = (file: File) => file.size > MAX_FILE_SIZE;

const UNITS = ['B', 'KB', 'MB', 'GB'];

export const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
};
