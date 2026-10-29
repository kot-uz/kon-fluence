import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Плейсхолдеры загружаемых файлов — декорации, а не узлы документа: в черновик и
// публикацию не попадают, а позиция сама сдвигается при правках вокруг.
// Когда файл загружен, на место плейсхолдера вставляется блок (см. useUploadFiles).

const uploadPlaceholderKey = new PluginKey<DecorationSet>('docsUploadPlaceholder');

/** Параметры плейсхолдера: позиция вставки, имя файла и подпись («Загружается»). */
export interface UploadPlaceholderSpec {
  id: string;
  pos: number;
  fileName: string;
  label: string;
}

// id → { dom, percent }: прогресс обновляется прямо в DOM, без транзакций редактора
const placeholders = new Map<string, { dom: HTMLElement; percent: number }>();

const renderProgress = (dom: HTMLElement, percent: number) => {
  const bar = dom.querySelector<HTMLElement>('.docs-upload-placeholder__bar');
  const value = dom.querySelector<HTMLElement>('.docs-upload-placeholder__percent');
  if (bar) bar.style.width = `${percent}%`;
  if (value) value.textContent = `${percent}%`;
};

const createPlaceholderDom = ({ id, fileName, label }: UploadPlaceholderSpec) => {
  const dom = document.createElement('div');
  dom.className = 'docs-upload-placeholder';
  dom.contentEditable = 'false';
  dom.innerHTML =
    '<div class="docs-upload-placeholder__row">' +
    '<span class="docs-upload-placeholder__name"></span>' +
    '<span class="docs-upload-placeholder__percent"></span>' +
    '</div>' +
    '<div class="docs-upload-placeholder__track"><div class="docs-upload-placeholder__bar"></div></div>';
  // имя файла — только как текст
  const name = dom.querySelector<HTMLElement>('.docs-upload-placeholder__name');
  if (name) name.textContent = `${label} ${fileName}`;
  // ProseMirror может перерисовать виджет — новый DOM получает текущий прогресс
  const percent = placeholders.get(id)?.percent || 0;
  placeholders.set(id, { dom, percent });
  renderProgress(dom, percent);
  return dom;
};

const findDecoration = (state: EditorState, id: string) =>
  uploadPlaceholderKey
    .getState(state)
    ?.find(undefined, undefined, (spec) => spec.id === id)[0];

/** Позиция плейсхолдера или null, если его уже нет. */
export const findUploadPlaceholder = (state: EditorState, id: string) =>
  findDecoration(state, id)?.from ?? null;

export const addUploadPlaceholder = (view: EditorView, add: UploadPlaceholderSpec) => {
  view.dispatch(view.state.tr.setMeta(uploadPlaceholderKey, { add }));
};

export const removeUploadPlaceholder = (tr: Transaction, id: string) => {
  placeholders.delete(id);
  return tr.setMeta(uploadPlaceholderKey, { remove: { id } });
};

export const setUploadProgress = (id: string, percent: number) => {
  const placeholder = placeholders.get(id);
  if (!placeholder) return;
  placeholder.percent = percent;
  renderProgress(placeholder.dom, percent);
};

/** Метаданные транзакции плагина. */
interface PlaceholderAction {
  add?: UploadPlaceholderSpec;
  remove?: { id: string };
}

const UploadPlaceholder = Extension.create({
  name: 'uploadPlaceholder',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: uploadPlaceholderKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            let next = set.map(tr.mapping, tr.doc);
            const action: PlaceholderAction | undefined = tr.getMeta(uploadPlaceholderKey);
            if (action?.add) {
              const { add } = action;
              // side: 1 — плейсхолдер остаётся после вставленного в ту же позицию блока:
              // при загрузке нескольких файлов сразу блоки встают в порядке выбора
              const widget = Decoration.widget(add.pos, () => createPlaceholderDom(add), {
                id: add.id,
                side: 1,
              });
              next = next.add(tr.doc, [widget]);
            }
            if (action?.remove) {
              const { remove } = action;
              next = next.remove(next.find(undefined, undefined, (spec) => spec.id === remove.id));
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export default UploadPlaceholder;
