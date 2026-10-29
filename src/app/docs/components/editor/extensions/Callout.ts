import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react';
import { CALLOUT_VARIANTS } from '../../../constants';
import type { CalloutVariant } from '../../../constants';
import CalloutView from './views/CalloutView';

const DEFAULT_VARIANT = CALLOUT_VARIANTS[0];

const parseVariant = (value: unknown): CalloutVariant =>
  CALLOUT_VARIANTS.includes(value as CalloutVariant) ? (value as CalloutVariant) : DEFAULT_VARIANT;

/**
 * Панель-callout (как «Info/Note/Warning» в Confluence): обёртка над блоками
 * с цветом и иконкой по варианту. Выход из панели — Enter в пустой строке в её конце.
 */
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: DEFAULT_VARIANT,
        parseHTML: (element) => parseVariant(element.getAttribute('data-variant')),
        renderHTML: (attributes) => ({ 'data-variant': attributes.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'callout' }, HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      // текущие блоки оборачиваются в панель; внутри панели — меняется её вариант
      setCallout:
        (attrs = {}) =>
        ({ editor, commands }) => {
          const variant = parseVariant(attrs.variant);
          if (editor.isActive(this.name)) return commands.updateAttributes(this.name, { variant });
          return commands.wrapIn(this.name, { variant });
        },
    };
  },
});

export default Callout;
