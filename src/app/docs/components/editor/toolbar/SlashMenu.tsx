import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import clsx from 'clsx';
import { useDocsTranslation } from '../../../adapters/platform';
import type { LocalizedBlockItem } from '../blockItems';

/** Что меню отдаёт редактору: обработчик клавиш из @tiptap/suggestion. */
export interface SlashMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

type SlashMenuProps = SuggestionProps<LocalizedBlockItem>;

/** Список блоков slash-меню. Клавиатура приходит из редактора через ref.onKeyDown. */
const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(({ items, command }, ref) => {
  const { t } = useDocsTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSelectedIndex(0), [items]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const select = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false;
      if (event.key === 'ArrowUp') {
        setSelectedIndex((index) => (index + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        select(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={t('DocsInsert')}
      className="w-256 max-h-320 overflow-y-auto py-4 rounded-lg shadow-lg bg-white dark:bg-dark border border-gray-200 dark:border-gray-700"
    >
      {items.length ? (
        items.map((item, index) => {
          const { Icon } = item;
          return (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              data-index={index}
              className={clsx(
                'flex items-center gap-12 w-full px-12 py-6 text-left text-sm',
                index === selectedIndex && 'bg-black/5 dark:bg-white/10'
              )}
              // не забирать фокус у редактора
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => select(index)}
            >
              <span
                className={clsx(
                  'flex items-center justify-center w-32 h-32 shrink-0 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300',
                  item.iconClassName
                )}
              >
                <Icon fontSize="small" />
              </span>
              {item.label}
            </button>
          );
        })
      ) : (
        <p className="px-12 py-6 text-sm text-gray-500">{t('DocsNothingFound')}</p>
      )}
    </div>
  );
});

/**
 * render() для @tiptap/suggestion: меню во всплывающем tippy у курсора.
 * Esc скрывает меню до выхода из «/запроса» — дальнейший ввод остаётся обычным текстом.
 */
export const renderSlashMenu: SuggestionOptions<LocalizedBlockItem>['render'] = () => {
  let component: ReactRenderer<SlashMenuRef, SlashMenuProps> | null = null;
  let popup: TippyInstance | null = null;
  let dismissed = false;

  return {
    onStart: (props) => {
      dismissed = false;
      component = new ReactRenderer(SlashMenu, { props, editor: props.editor });
      if (!props.clientRect) return;
      popup = tippy(document.body, {
        getReferenceClientRect: props.clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        maxWidth: 'none',
        zIndex: 1300,
      });
    },

    onUpdate: (props) => {
      component?.updateProps(props);
      if (props.clientRect) {
        popup?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
      }
    },

    onKeyDown: (props) => {
      if (dismissed) return false;
      if (props.event.key === 'Escape') {
        dismissed = true;
        popup?.hide();
        return true;
      }
      return component?.ref?.onKeyDown(props) ?? false;
    },

    onExit: () => {
      popup?.destroy();
      component?.destroy();
      popup = null;
      component = null;
    },
  };
};

export default SlashMenu;
