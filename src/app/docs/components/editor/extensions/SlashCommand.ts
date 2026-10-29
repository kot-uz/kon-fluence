import { Extension } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { filterBlockItems, getBlockItems, runBlockItem } from '../blockItems';
import type { LocalizedBlockItem } from '../blockItems';
import type { DocsTranslate } from '../../../adapters/platform';
import { renderSlashMenu } from '../toolbar/SlashMenu';
import type { OnFiles } from './FileDropPaste';

export interface SlashCommandOptions {
  translate: DocsTranslate;
  onFiles: OnFiles | null;
}

/**
 * «/» в начале строки или после пробела → меню вставки блоков с фильтром по вводу.
 * translate(key, params) — перевод названий блоков; onFiles(files, pos) — загрузка вложений.
 */
const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return { translate: ((key: string) => key) as DocsTranslate, onFiles: null };
  },

  addProseMirrorPlugins() {
    const { translate, onFiles } = this.options;
    return [
      Suggestion<LocalizedBlockItem>({
        editor: this.editor,
        pluginKey: new PluginKey('docsSlashCommand'),
        char: '/',
        // в блоке кода «/» — обычный символ
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ editor, query }) => filterBlockItems(getBlockItems(translate, editor), query),
        command: ({ editor, range, props: item }) =>
          runBlockItem(item, { editor, range, onFiles: onFiles ?? undefined }),
        render: renderSlashMenu,
      }),
    ];
  },
});

export default SlashCommand;
