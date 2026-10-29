import { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { Editor } from '@tiptap/react';
import { useDocsTranslation, useNotify } from '../adapters/platform';
import { uploadAttachment } from '../api/attachmentsTransport';
import { BLOCK_TYPES, MAX_FILE_SIZE } from '../constants';
import type { BlockType } from '../constants';
import {
  addUploadPlaceholder,
  findUploadPlaceholder,
  removeUploadPlaceholder,
  setUploadProgress,
} from '../components/editor/extensions/UploadPlaceholder';
import { formatSize, getBlockTypeByFile, isFileTooLarge } from '../utils/fileTypes';
import type { Attachment } from '../types';

const getBlockAttrs = (type: BlockType, { id, fileName, mimeType, size }: Attachment) => {
  switch (type) {
    case BLOCK_TYPES.IMAGE:
      return { fileId: id, fileName, alt: fileName };
    case BLOCK_TYPES.FILE:
      return { fileId: id, fileName, mimeType, size };
    default:
      return { fileId: id, fileName, mimeType };
  }
};

/**
 * Загрузка файлов в редакторе: проверка размера → плейсхолдер с прогрессом в позиции pos →
 * после загрузки на его место вставляется блок по типу файла (картинка/видео/аудио/файл).
 * pendingCount — сколько файлов ещё загружается (публиковать в это время нельзя).
 */
export const useUploadFiles = ({
  editor,
  pageId,
}: {
  editor: Editor | null;
  pageId: string;
}) => {
  const { t } = useDocsTranslation();
  const notify = useNotify();
  const [pendingCount, setPendingCount] = useState(0);
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const uploadFile = useCallback(
    async (file: File, pos: number) => {
      const id = nanoid();
      const view = editorRef.current?.view;
      if (!view) return;
      addUploadPlaceholder(view, {
        id,
        pos,
        fileName: file.name,
        label: t('DocsUploading'),
      });
      setPendingCount((count) => count + 1);

      // редактор мог быть уничтожен, пока шла загрузка (ушли со страницы, перезагрузили версию)
      const getLiveEditor = () => {
        const { current } = editorRef;
        return current && !current.isDestroyed ? current : null;
      };

      try {
        const attachment = await uploadAttachment({
          file,
          pageId,
          onProgress: (percent) => setUploadProgress(id, percent),
        });
        const current = getLiveEditor();
        const at = current && findUploadPlaceholder(current.state, id);
        if (typeof at !== 'number' || !current) return;
        const type = getBlockTypeByFile(file);
        const node = current.schema.nodes[type].create(getBlockAttrs(type, attachment));
        current.view.dispatch(
          removeUploadPlaceholder(current.state.tr, id).replaceRangeWith(at, at, node)
        );
      } catch {
        const current = getLiveEditor();
        if (current) current.view.dispatch(removeUploadPlaceholder(current.state.tr, id));
        notify(t('DocsUploadFailed', { name: file.name }), 'error');
      } finally {
        setPendingCount((count) => count - 1);
      }
    },
    [pageId, t, notify]
  );

  /** uploadFiles(files, pos = позиция курсора) */
  const uploadFiles = useCallback(
    (files: ArrayLike<File>, pos?: number) => {
      const { current } = editorRef;
      if (!current || current.isDestroyed) return;
      const at = typeof pos === 'number' ? pos : current.state.selection.from;
      Array.from(files).forEach((file) => {
        if (isFileTooLarge(file)) {
          notify(
            t('DocsFileTooLarge', { name: file.name, size: formatSize(MAX_FILE_SIZE) }),
            'error'
          );
          return;
        }
        uploadFile(file, at);
      });
    },
    [uploadFile, notify, t]
  );

  return { uploadFiles, pendingCount };
};

/** Колбэк загрузки файлов, который передаётся в редактор и панель вставки. */
export type UploadFiles = ReturnType<typeof useUploadFiles>['uploadFiles'];
