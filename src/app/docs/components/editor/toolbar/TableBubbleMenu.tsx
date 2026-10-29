import type { ReactNode } from 'react';
import { BubbleMenu } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { EditorState } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Divider, IconButton } from '@mui/material';
import type { IconButtonProps } from '@mui/material';
import { CallMerge, CallSplit, DeleteOutline } from '@mui/icons-material';
import { useDocsTranslation } from '../../../adapters/platform';
import {
  AddColLeftIcon,
  AddColRightIcon,
  AddRowAboveIcon,
  AddRowBelowIcon,
  DeleteColIcon,
  DeleteRowIcon,
  HeaderColIcon,
  HeaderRowIcon,
} from './tableIcons';

// Ближайшая таблица вокруг курсора: { node, pos } или null.
const findTable = (state: EditorState) => {
  const { $anchor } = state.selection;
  for (let { depth } = $anchor; depth > 0; depth -= 1) {
    const node = $anchor.node(depth);
    if (node.type.name === 'table') return { node, pos: $anchor.before(depth) };
  }
  return null;
};

const isHeader = (cell: ProseMirrorNode | null) => cell?.type.name === 'tableHeader';

const hasHeaderRow = (table: ProseMirrorNode) => {
  let result = true;
  table.firstChild?.forEach((cell) => {
    if (!isHeader(cell)) result = false;
  });
  return result;
};

const hasHeaderColumn = (table: ProseMirrorNode) => {
  let result = true;
  table.forEach((row) => {
    if (!isHeader(row.firstChild)) result = false;
  });
  return result;
};

/** Кнопка меню таблицы. */
interface TableButton {
  key: string;
  title: string;
  icon: ReactNode;
  disabled?: boolean;
  active?: boolean;
  color?: IconButtonProps['color'];
  onClick: () => void;
}

export interface TableBubbleMenuProps {
  editor: Editor;
}

const TableBubbleMenu = ({ editor }: TableBubbleMenuProps) => {
  const { t } = useDocsTranslation();

  // меню привязано к таблице целиком, а не к выделению: так оно не прыгает между ячейками
  const getReferenceClientRect = () => {
    const table = findTable(editor.state);
    const dom = table && editor.view.nodeDOM(table.pos);
    return dom instanceof HTMLElement ? dom.getBoundingClientRect() : new DOMRect();
  };

  const table = findTable(editor.state);
  const can = editor.can();
  const chain = () => editor.chain().focus();

  const groups: TableButton[][] = [
    [
      {
        key: 'rowAbove',
        title: t('DocsAddRowAbove'),
        icon: <AddRowAboveIcon />,
        disabled: !can.addRowBefore(),
        onClick: () => chain().addRowBefore().run(),
      },
      {
        key: 'rowBelow',
        title: t('DocsAddRowBelow'),
        icon: <AddRowBelowIcon />,
        disabled: !can.addRowAfter(),
        onClick: () => chain().addRowAfter().run(),
      },
      {
        key: 'rowDelete',
        title: t('DocsDeleteRow'),
        icon: <DeleteRowIcon />,
        disabled: !can.deleteRow(),
        onClick: () => chain().deleteRow().run(),
      },
    ],
    [
      {
        key: 'colLeft',
        title: t('DocsAddColLeft'),
        icon: <AddColLeftIcon />,
        disabled: !can.addColumnBefore(),
        onClick: () => chain().addColumnBefore().run(),
      },
      {
        key: 'colRight',
        title: t('DocsAddColRight'),
        icon: <AddColRightIcon />,
        disabled: !can.addColumnAfter(),
        onClick: () => chain().addColumnAfter().run(),
      },
      {
        key: 'colDelete',
        title: t('DocsDeleteCol'),
        icon: <DeleteColIcon />,
        disabled: !can.deleteColumn(),
        onClick: () => chain().deleteColumn().run(),
      },
    ],
    [
      {
        key: 'headerRow',
        title: t('DocsToggleHeaderRow'),
        icon: <HeaderRowIcon />,
        active: !!table && hasHeaderRow(table.node),
        onClick: () => chain().toggleHeaderRow().run(),
      },
      {
        key: 'headerCol',
        title: t('DocsToggleHeaderCol'),
        icon: <HeaderColIcon />,
        active: !!table && hasHeaderColumn(table.node),
        onClick: () => chain().toggleHeaderColumn().run(),
      },
      {
        key: 'merge',
        title: t('DocsMergeCells'),
        icon: <CallMerge />,
        disabled: !can.mergeCells(),
        onClick: () => chain().mergeCells().run(),
      },
      {
        key: 'split',
        title: t('DocsSplitCell'),
        icon: <CallSplit />,
        disabled: !can.splitCell(),
        onClick: () => chain().splitCell().run(),
      },
    ],
    [
      {
        key: 'deleteTable',
        title: t('DocsDeleteTable'),
        icon: <DeleteOutline />,
        color: 'error',
        onClick: () => chain().deleteTable().run(),
      },
    ],
  ];

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="docsTableBubbleMenu"
      updateDelay={0}
      shouldShow={({ editor: current }) => current.isEditable && current.isActive('table')}
      tippyOptions={{
        getReferenceClientRect,
        // под таблицей (как в Confluence), чтобы не закрывать текст над ней
        placement: 'bottom-start',
        maxWidth: 'none',
        offset: [0, 8],
        popperOptions: {
          modifiers: [
            { name: 'flip', options: { fallbackPlacements: ['top-start'] } },
            // высокая таблица: меню остаётся в видимой области, пока таблица на экране
            { name: 'preventOverflow', options: { altAxis: true, tether: false } },
          ],
        },
      }}
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg bg-white dark:bg-dark border border-gray-200 dark:border-gray-700">
        {groups.map((group, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <Divider orientation="vertical" flexItem className="mx-4" />}
            {/* нативный title вместо MUI Tooltip: BubbleMenu скрывает меню, не размонтируя его,
                и открытая подсказка оставалась привязанной к скрытой кнопке */}
            {group.map((button) => (
              <span key={button.key} title={button.title}>
                <IconButton
                  size="small"
                  disabled={button.disabled}
                  color={button.color || (button.active ? 'secondary' : 'default')}
                  className={button.active ? 'bg-black/5 dark:bg-white/10' : ''}
                  aria-label={button.title}
                  aria-pressed={button.active}
                  // не забирать фокус у редактора — иначе пропадёт выделение ячеек
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={button.onClick}
                >
                  {button.icon}
                </IconButton>
              </span>
            ))}
          </div>
        ))}
      </div>
    </BubbleMenu>
  );
};

export default TableBubbleMenu;
