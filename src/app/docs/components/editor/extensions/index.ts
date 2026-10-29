import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Table, { TableView } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { DocsTranslate } from '../../../adapters/platform';
import TaskItemWithId from './TaskItemWithId';
import ImageBlock from './ImageBlock';
import VideoBlock from './VideoBlock';
import AudioBlock from './AudioBlock';
import FileBlock from './FileBlock';
import Callout from './Callout';
import SlashCommand from './SlashCommand';
import UploadPlaceholder from './UploadPlaceholder';
import FileDropPaste from './FileDropPaste';
import type { OnFiles } from './FileDropPaste';
import { isAllowedLink } from '../../../utils/link';

// TableView (div.tableWrapper > table > colgroup) и в просмотре: статичный renderHTML
// не обновляет <colgroup>, когда при setContent меняются только ширины/число столбцов —
// ProseMirror переиспользует DOM таблицы. В редактировании это тот же View, что ставит
// columnResizing. Обёртка даёт горизонтальный скролл широким таблицам.
const DocsTable = Table.extend({
  addNodeView() {
    return ({ node }) => new TableView(node, this.options.cellMinWidth);
  },
});

/** Параметры набора расширений: всё, чем просмотр отличается от редактирования. */
export interface ExtensionsOptions {
  editable?: boolean;
  placeholder?: string;
  /** Отметка ToDo в просмотре; false — вернуть чекбокс назад. */
  onTaskToggle?: (taskId: string, checked: boolean) => boolean;
  /** aria-label чекбокса ToDo. */
  getTaskLabel?: (text: string, checked: boolean) => string;
  /** Файлы, перетащенные, вставленные или выбранные в slash-меню (только в редактировании). */
  onFiles?: OnFiles;
  /** Перевод названий блоков slash-меню. */
  translate?: DocsTranslate;
}

// Один набор расширений для просмотра и редактирования — иначе один и тот же JSON
// отрендерится по-разному.
export const getExtensions = ({
  editable = false,
  placeholder = '',
  onTaskToggle,
  getTaskLabel,
  onFiles,
  translate,
}: ExtensionsOptions = {}) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
  }),
  Underline,
  Link.configure({
    openOnClick: !editable,
    autolink: true,
    linkOnPaste: true,
    defaultProtocol: 'https',
    isAllowedUri: (url) => isAllowedLink(url),
    HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
  }),
  Placeholder.configure({ placeholder }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  DocsTable.configure({ resizable: true, cellMinWidth: 80 }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItemWithId.configure({
    nested: true,
    a11y: getTaskLabel && {
      checkboxLabel: (node: ProseMirrorNode, checked: boolean) =>
        getTaskLabel(node.textContent, checked),
    },
    onReadOnlyChecked: (node: ProseMirrorNode, checked: boolean) =>
      !!node.attrs.id && !!onTaskToggle && onTaskToggle(node.attrs.id, checked),
  }),
  ImageBlock,
  VideoBlock,
  AudioBlock,
  FileBlock,
  Callout,
  ...(editable
    ? [
        UploadPlaceholder,
        FileDropPaste.configure({ onFiles: onFiles ?? null }),
        SlashCommand.configure({ translate, onFiles: onFiles ?? null }),
      ]
    : []),
];
