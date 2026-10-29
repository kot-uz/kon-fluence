import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { useDocsTranslation } from '../../adapters/platform';
import { EMPTY_DOC } from '../../constants';
import type { DocContent } from '../../types';
import { getExtensions } from './extensions';

import '../../styles/docs-content.css';

export interface UseDocEditorOptions {
  content?: DocContent | null;
  editable: boolean;
  placeholder?: string;
  onUpdate?: (editor: Editor) => void;
  /** Отметка ToDo в просмотре; false — вернуть чекбокс назад. */
  onTaskToggle?: (taskId: string, checked: boolean) => boolean;
  onFiles?: (files: File[], pos: number) => void;
}

/**
 * Редактор TipTap для просмотра и редактирования. Контент передаётся только при создании:
 * для смены страницы компонент пересоздаётся (key), для обновления в просмотре —
 * setContent в эффекте.
 */
export const useDocEditor = ({
  content,
  editable,
  placeholder,
  onUpdate,
  onTaskToggle,
  onFiles,
}: UseDocEditorOptions) => {
  const { t } = useDocsTranslation();
  // t меняется при смене языка, а расширения создаются один раз
  const tRef = useRef(t);
  tRef.current = t;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  // расширения создаются один раз — колбэк читаем через ref, чтобы не замыкать устаревший
  const onTaskToggleRef = useRef(onTaskToggle);
  onTaskToggleRef.current = onTaskToggle;
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  return useEditor(
    {
      extensions: getExtensions({
        editable,
        placeholder,
        onTaskToggle: (taskId, checked) => onTaskToggleRef.current?.(taskId, checked) ?? false,
        getTaskLabel: (text, checked) =>
          `${tRef.current(checked ? 'DocsTaskDone' : 'DocsTaskNotDone')}: ${
            text || tRef.current('DocsTaskEmpty')
          }`,
        onFiles: (files, pos) => onFilesRef.current?.(files, pos),
        translate: (key, params) => tRef.current(key, params),
      }),
      content: content || EMPTY_DOC,
      editable,
      // в просмотре перерисовывать React на каждую транзакцию незачем
      shouldRerenderOnTransaction: editable,
      editorProps: {
        attributes: { class: 'docs-content prose dark:prose-invert max-w-none' },
      },
      onUpdate: ({ editor }) => onUpdateRef.current?.(editor),
    },
    [editable]
  );
};

export interface DocEditorContentProps {
  editor: Editor | null;
  className?: string;
}

export const DocEditorContent = ({ editor, className }: DocEditorContentProps) => (
  <EditorContent editor={editor} className={className} />
);

export interface DocViewerProps {
  content?: DocContent | null;
  onTaskToggle?: (taskId: string, checked: boolean) => boolean;
}

// Просмотр: контент синхронизируется с данными страницы (после публикации, отметки ToDo и т.п.).
// onTaskToggle не передан — чекбоксы ToDo только для чтения.
const DocViewer = ({ content, onTaskToggle }: DocViewerProps) => {
  const editor = useDocEditor({ content, editable: false, onTaskToggle });
  // контент, с которым редактор уже синхронизирован (сначала — переданный при создании)
  const appliedContentRef = useRef(content);

  useEffect(() => {
    if (!editor || editor.isDestroyed || content === appliedContentRef.current) return;
    appliedContentRef.current = content;
    // setContent создаёт React node view блоков-вложений через flushSync — вне фазы
    // эффектов, иначе React предупреждает о flushSync внутри lifecycle
    queueMicrotask(() => {
      // пока ждали, мог прийти более свежий контент — его применит следующий микротаск
      if (editor.isDestroyed || appliedContentRef.current !== content) return;
      const next = content || EMPTY_DOC;
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next)) {
        editor.commands.setContent(next, false);
      }
    });
  }, [editor, content]);

  return <DocEditorContent editor={editor} className={onTaskToggle ? '' : 'docs-tasks-readonly'} />;
};

export default DocViewer;
