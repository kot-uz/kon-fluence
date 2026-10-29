import type { ChainedCommands, Editor, Range } from '@tiptap/react';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  AudioFile,
  CheckBoxOutlined,
  DataObject,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  HorizontalRule,
  Image,
  InsertDriveFile,
  Movie,
  ShortText,
  TableChart,
  Title,
} from '@mui/icons-material';
import { BLOCK_TYPES, CALLOUT_VARIANTS, MEDIA_ACCEPT } from '../../constants';
import type { BlockType } from '../../constants';
import { pickFiles } from '../../utils/pickFiles';
import type { DocsTranslate } from '../../adapters/platform';
import { CALLOUT_ICONS, CALLOUT_TITLES } from './calloutVariants';

/** Блок, который можно вставить через slash-меню или «+ Вставить». */
export interface BlockItem {
  key: string;
  /** Ключ перевода названия. */
  title: string;
  titleParams?: Record<string, unknown>;
  aliases: string[];
  Icon: SvgIconComponent;
  iconClassName?: string;
  /** Группа для разделителей в «+ Вставить». */
  group?: string;
  insertMenu?: boolean;
  /** Тип вложения: вместо команды открывается выбор файлов. */
  upload?: BlockType;
  isDisabled?: (editor: Editor) => boolean;
  run?: (chain: ChainedCommands) => ChainedCommands;
}

/** Блок с уже переведённым названием — в таком виде он попадает в меню. */
export interface LocalizedBlockItem extends BlockItem {
  label: string;
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

const MEDIA_ITEMS: BlockItem[] = [
  {
    key: 'image',
    upload: BLOCK_TYPES.IMAGE,
    title: 'DocsImage',
    aliases: ['image', 'picture', 'img', 'photo', 'картинка', 'изображение', 'фото'],
    Icon: Image,
  },
  {
    key: 'video',
    upload: BLOCK_TYPES.VIDEO,
    title: 'DocsVideo',
    aliases: ['video', 'movie', 'видео'],
    Icon: Movie,
  },
  {
    key: 'audio',
    upload: BLOCK_TYPES.AUDIO,
    title: 'DocsAudio',
    aliases: ['audio', 'sound', 'music', 'аудио', 'звук'],
    Icon: AudioFile,
  },
  {
    key: 'file',
    upload: BLOCK_TYPES.FILE,
    title: 'DocsFile',
    aliases: ['file', 'attachment', 'файл', 'вложение'],
    Icon: InsertDriveFile,
  },
];

/**
 * Блоки, которые можно вставить через slash-меню и «+ Вставить» (insertMenu: true).
 * run(chain) дополняет цепочку команд; upload — тип файла для выбора и загрузки.
 * aliases — английские и русские слова для фильтра (локализованное название ищется всегда).
 */
const BLOCK_ITEMS: BlockItem[] = [
  {
    key: 'paragraph',
    title: 'DocsParagraph',
    aliases: ['text', 'paragraph', 'текст', 'абзац'],
    Icon: ShortText,
    run: (chain) => chain.setParagraph(),
  },
  ...HEADING_LEVELS.map((level) => ({
    key: `h${level}`,
    title: 'DocsHeading',
    titleParams: { level },
    aliases: [`h${level}`, 'heading', 'title', 'заголовок'],
    Icon: Title,
    run: (chain: ChainedCommands) => chain.setHeading({ level }),
  })),
  {
    key: 'bulletList',
    title: 'DocsBulletList',
    aliases: ['bullet', 'list', 'ul', 'список', 'маркированный'],
    Icon: FormatListBulleted,
    run: (chain) => chain.toggleBulletList(),
  },
  {
    key: 'orderedList',
    title: 'DocsOrderedList',
    aliases: ['numbered', 'ordered', 'list', 'ol', 'список', 'нумерованный'],
    Icon: FormatListNumbered,
    run: (chain) => chain.toggleOrderedList(),
  },
  {
    key: 'taskList',
    title: 'DocsTodoList',
    aliases: ['todo', 'task', 'checkbox', 'задачи', 'чекбокс', 'список'],
    Icon: CheckBoxOutlined,
    run: (chain) => chain.toggleTaskList(),
  },
  {
    key: 'table',
    title: 'DocsTable',
    aliases: ['table', 'grid', 'таблица'],
    Icon: TableChart,
    insertMenu: true,
    // вложенные таблицы не поддерживаем
    isDisabled: (editor) => editor.isActive('table'),
    run: (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  },
  ...MEDIA_ITEMS.map((item) => ({ ...item, insertMenu: true })),
  ...CALLOUT_VARIANTS.map((variant) => ({
    key: `callout-${variant}`,
    title: CALLOUT_TITLES[variant],
    aliases: ['callout', 'panel', 'note', variant, 'панель'],
    Icon: CALLOUT_ICONS[variant],
    iconClassName: `docs-callout-icon--${variant}`,
    group: 'callout',
    insertMenu: true,
    run: (chain: ChainedCommands) => chain.setCallout({ variant }),
  })),
  {
    key: 'quote',
    title: 'DocsQuote',
    aliases: ['quote', 'blockquote', 'цитата'],
    Icon: FormatQuote,
    run: (chain) => chain.toggleBlockquote(),
  },
  {
    key: 'codeBlock',
    title: 'DocsCodeBlock',
    aliases: ['code', 'pre', 'код'],
    Icon: DataObject,
    run: (chain) => chain.toggleCodeBlock(),
  },
  {
    key: 'divider',
    title: 'DocsDivider',
    aliases: ['divider', 'hr', 'line', 'separator', 'разделитель', 'линия'],
    Icon: HorizontalRule,
    run: (chain) => chain.setHorizontalRule(),
  },
];

/** Блоки с локализованным label; без editor — все, с editor — только доступные в позиции курсора. */
export const getBlockItems = (translate: DocsTranslate, editor?: Editor): LocalizedBlockItem[] =>
  BLOCK_ITEMS.filter((item) => !editor || !item.isDisabled?.(editor)).map((item) => ({
    ...item,
    label: translate(item.title, item.titleParams),
  }));

export const getInsertMenuItems = (translate: DocsTranslate) =>
  getBlockItems(translate).filter((item) => item.insertMenu);

export const filterBlockItems = (items: LocalizedBlockItem[], query: string) => {
  const value = query.trim().toLowerCase();
  if (!value) return items;
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(value) ||
      item.aliases.some((alias) => alias.startsWith(value))
  );
};

/**
 * Вставить блок. range — текст «/запрос», который нужно удалить (slash-меню).
 * Для вложений открывается выбор файлов; загрузка — в onFiles(files, pos) в позиции курсора.
 */
export const runBlockItem = (
  item: BlockItem,
  {
    editor,
    range,
    onFiles,
  }: { editor: Editor; range?: Range; onFiles?: (files: File[], pos: number) => void }
) => {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);

  if (item.upload) {
    chain.run();
    const pos = editor.state.selection.from;
    pickFiles({ accept: MEDIA_ACCEPT[item.upload] }).then((files) => {
      if (!editor.isDestroyed) onFiles?.(files, pos);
    });
    return;
  }

  item.run?.(chain).run();
};
