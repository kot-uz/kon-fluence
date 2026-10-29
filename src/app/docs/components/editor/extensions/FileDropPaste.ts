import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/** Колбэк загрузки: файлы и позиция в документе, куда их вставить. */
export type OnFiles = (files: File[], pos: number) => void;

export interface FileDropPasteOptions {
  onFiles: OnFiles | null;
}

// При копировании из Word/Excel в буфере есть и HTML с текстом, и картинка-снимок —
// тогда вставляется текст. Картинка из браузера приходит как HTML с одним <img> без текста,
// скриншот и файл из проводника — без HTML: их загружаем.
const hasHtmlText = (clipboardData: DataTransfer) => {
  const html = clipboardData.getData('text/html');
  if (!html) return false;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return !!doc.body.textContent?.trim();
};

// Файлы, перетащенные в редактор или вставленные из буфера (скриншот по Ctrl+V),
// передаются в onFiles(files, pos) — загрузку и вставку блоков делает useUploadFiles.
const FileDropPaste = Extension.create<FileDropPasteOptions>({
  name: 'fileDropPaste',

  addOptions() {
    return { onFiles: null };
  },

  addProseMirrorPlugins() {
    const { onFiles } = this.options;
    if (!onFiles) return [];
    return [
      new Plugin({
        key: new PluginKey('docsFileDropPaste'),
        props: {
          handleDrop(view, event, _slice, moved) {
            const files = Array.from((event as DragEvent).dataTransfer?.files || []);
            if (moved || !files.length) return false;
            event.preventDefault();
            const { clientX, clientY } = event as DragEvent;
            const coords = view.posAtCoords({ left: clientX, top: clientY });
            onFiles(files, coords ? coords.pos : view.state.selection.from);
            return true;
          },
          handlePaste(view, event) {
            const { clipboardData } = event;
            const files = Array.from(clipboardData?.files || []);
            if (!files.length || !clipboardData || hasHtmlText(clipboardData)) return false;
            event.preventDefault();
            onFiles(files, view.state.selection.from);
            return true;
          },
        },
      }),
    ];
  },
});

export default FileDropPaste;
