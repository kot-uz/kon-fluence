import type { DocContent, SpaceKey, SpaceType } from './types';

// Тип пространства документации: PROJECT — привязано к проекту, SPACE — самостоятельное.
export const SPACE_TYPES = {
  PROJECT: 'project',
  SPACE: 'space',
} as const;

// Префикс роутов документации.
export const DOCS_BASE_PATH = '/docs';

export const DOCS_MODE = {
  VIEW: 'view',
  EDIT: 'edit',
} as const;

export const SIDEBAR_WIDTH = 280;

export const PAGE_TITLE_MAX_LENGTH = 255;

export const EMPTY_DOC: DocContent = { type: 'doc', content: [] };

export const getSpaceKey = (spaceType: SpaceType, spaceId: string): SpaceKey =>
  `${spaceType}:${spaceId}`;

// Вложения: тип блока определяется по MIME и расширению (utils/fileTypes.ts)
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const BLOCK_TYPES = {
  IMAGE: 'imageBlock',
  VIDEO: 'videoBlock',
  AUDIO: 'audioBlock',
  FILE: 'fileBlock',
} as const;

/** Тип блока-вложения в документе. */
export type BlockType = (typeof BLOCK_TYPES)[keyof typeof BLOCK_TYPES];

/** Типы блоков, которые встраиваются в страницу (у них есть список расширений). */
export type MediaBlockType = Exclude<BlockType, typeof BLOCK_TYPES.FILE>;

export const MEDIA_EXTENSIONS: Record<MediaBlockType, string[]> = {
  [BLOCK_TYPES.IMAGE]: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp'],
  [BLOCK_TYPES.VIDEO]: ['mp4', 'webm', 'ogg', 'ogv'],
  [BLOCK_TYPES.AUDIO]: ['mp3', 'wav', 'ogg', 'oga', 'm4a'],
};

const toAccept = (type: MediaBlockType) =>
  MEDIA_EXTENSIONS[type].map((ext) => `.${ext}`).join(',');

// значение accept для <input type="file"> при выборе файла конкретного типа
export const MEDIA_ACCEPT: Record<BlockType, string | undefined> = {
  [BLOCK_TYPES.IMAGE]: toAccept(BLOCK_TYPES.IMAGE),
  [BLOCK_TYPES.VIDEO]: toAccept(BLOCK_TYPES.VIDEO),
  [BLOCK_TYPES.AUDIO]: toAccept(BLOCK_TYPES.AUDIO),
  [BLOCK_TYPES.FILE]: undefined,
};

export const IMAGE_WIDTHS = [25, 50, 75, 100];

// первый — вариант по умолчанию
export const CALLOUT_VARIANTS = ['info', 'success', 'warning', 'error'] as const;

/** Вариант панели-callout. */
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];
