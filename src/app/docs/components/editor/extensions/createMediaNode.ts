import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react';
import type { Attributes, CommandProps, RawCommands } from '@tiptap/react';
import type { ComponentType } from 'react';

/** Значения атрибутов блока-вложения по умолчанию: по ним же определяется их тип. */
export type MediaDefaults = Record<string, string | number | null>;

const toDataAttribute = (name: string) =>
  `data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

// Атрибуты дублируются в data-* — иначе они потеряются при копировании блока через буфер
// (ProseMirror переносит узлы как HTML). Числовые атрибуты определяются по значению по умолчанию.
const buildAttributes = (defaults: MediaDefaults): Attributes =>
  Object.fromEntries(
    Object.entries(defaults).map(([name, defaultValue]) => [
      name,
      {
        default: defaultValue,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute(toDataAttribute(name));
          if (value === null) return defaultValue;
          return typeof defaultValue === 'number' ? Number(value) || defaultValue : value;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes[name] === null || attributes[name] === undefined
            ? {}
            : { [toDataAttribute(name)]: attributes[name] },
      },
    ])
  );

/** Параметры блока-вложения. */
export interface MediaNodeOptions {
  name: string;
  dataType: string;
  defaults: MediaDefaults;
  /** React-компонент node view. Пропсы приходят от ReactNodeViewRenderer. */
  view: ComponentType<any>;
  commandName: string;
}

/**
 * Блок-вложение (картинка, видео, аудио, файл): atom-узел с React node view.
 * В JSON хранится только fileId и метаданные — URL получается в рантайме (useAttachmentUrl).
 * Команда вставки: editor.commands[commandName](attrs).
 */
const createMediaNode = ({ name, dataType, defaults, view, commandName }: MediaNodeOptions) =>
  Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
      return buildAttributes(defaults);
    },

    parseHTML() {
      return [{ tag: `div[data-type="${dataType}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes({ 'data-type': dataType }, HTMLAttributes)];
    },

    addNodeView() {
      return ReactNodeViewRenderer(view);
    },

    addCommands() {
      // имя команды задаётся параметром, поэтому в типах оно описано вручную — commands.d.ts
      return {
        [commandName]:
          (attrs: Record<string, unknown>) =>
          ({ commands }: CommandProps) =>
            commands.insertContent({ type: name, attrs }),
      } as Partial<RawCommands>;
    },
  });

export default createMediaNode;
