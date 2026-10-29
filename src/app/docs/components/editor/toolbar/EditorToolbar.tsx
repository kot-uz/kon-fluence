import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Divider, IconButton, Menu, MenuItem, Select, Tooltip } from '@mui/material';
import type { Editor } from '@tiptap/react';
import {
  BorderColor,
  CheckBoxOutlined,
  Code,
  DataObject,
  FormatAlignCenter,
  FormatAlignJustify,
  FormatAlignLeft,
  FormatAlignRight,
  FormatBold,
  FormatColorReset,
  FormatColorText,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  FormatUnderlined,
  HorizontalRule,
  Link as LinkIcon,
  Redo,
  StrikethroughS,
  Undo,
} from '@mui/icons-material';
import { useDocsTranslation } from '../../../adapters/platform';
import type { UploadFiles } from '../../../hooks/useUploadFiles';
import LinkDialog from './LinkDialog';
import InsertMenu from './InsertMenu';

const TEXT_COLORS = ['#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#2563EB', '#7C3AED', '#6B7280'];
const HIGHLIGHT_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA', '#E5E7EB'];
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** Кнопка панели: активность определяется маркой, узлом, выравниванием или флагом active. */
interface ToolbarItem {
  key: string;
  title: string;
  icon: ReactNode;
  mark?: string;
  node?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  active?: boolean;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

interface ToolbarButtonProps {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
}

const ToolbarButton = ({ title, active, disabled, onClick, children }: ToolbarButtonProps) => (
  <Tooltip title={title}>
    <span>
      <IconButton
        size="small"
        disabled={disabled}
        onClick={onClick}
        onMouseDown={(event) => event.preventDefault()}
        color={active ? 'secondary' : 'default'}
        className={active ? 'bg-black/5 dark:bg-white/10' : ''}
        aria-pressed={!!active}
      >
        {children}
      </IconButton>
    </span>
  </Tooltip>
);

interface ColorMenuProps {
  anchorEl: HTMLElement | null;
  colors: string[];
  resetLabel: string;
  onSelect: (color: string | null) => void;
  onClose: () => void;
}

const ColorMenu = ({ anchorEl, colors, resetLabel, onSelect, onClose }: ColorMenuProps) => (
  <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={onClose}>
    <div className="flex gap-6 px-12 py-4">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          className="w-24 h-24 rounded border border-black/10"
          style={{ backgroundColor: color }}
          onClick={() => onSelect(color)}
        />
      ))}
    </div>
    <MenuItem onClick={() => onSelect(null)}>
      <FormatColorReset fontSize="small" className="mr-8" />
      {resetLabel}
    </MenuItem>
  </Menu>
);

const getBlockType = (editor: Editor) => {
  const level = HEADING_LEVELS.find((item) => editor.isActive('heading', { level: item }));
  return level ? `h${level}` : 'p';
};

export interface EditorToolbarProps {
  editor: Editor | null;
  onUploadFiles: UploadFiles;
}

const EditorToolbar = ({ editor, onUploadFiles }: EditorToolbarProps) => {
  const { t } = useDocsTranslation();
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [highlightAnchor, setHighlightAnchor] = useState<HTMLElement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  if (!editor) return null;

  const chain = () => editor.chain().focus();

  const setBlockType = (value: string) => {
    if (value === 'p') {
      chain().setParagraph().run();
      return;
    }
    const level = HEADING_LEVELS.find((item) => `h${item}` === value);
    if (level) chain().setHeading({ level }).run();
  };

  const setColor = (color: string | null) => {
    if (color) chain().setColor(color).run();
    else chain().unsetColor().run();
    setColorAnchor(null);
  };

  const setHighlight = (color: string | null) => {
    if (color) chain().setHighlight({ color }).run();
    else chain().unsetHighlight().run();
    setHighlightAnchor(null);
  };

  const groups: ToolbarItem[][] = [
    [
      {
        key: 'undo',
        title: t('DocsUndo'),
        icon: <Undo />,
        disabled: !editor.can().undo(),
        onClick: () => chain().undo().run(),
      },
      {
        key: 'redo',
        title: t('DocsRedo'),
        icon: <Redo />,
        disabled: !editor.can().redo(),
        onClick: () => chain().redo().run(),
      },
    ],
    [
      {
        key: 'bold',
        title: t('DocsBold'),
        icon: <FormatBold />,
        mark: 'bold',
        onClick: () => chain().toggleBold().run(),
      },
      {
        key: 'italic',
        title: t('DocsItalic'),
        icon: <FormatItalic />,
        mark: 'italic',
        onClick: () => chain().toggleItalic().run(),
      },
      {
        key: 'underline',
        title: t('DocsUnderline'),
        icon: <FormatUnderlined />,
        mark: 'underline',
        onClick: () => chain().toggleUnderline().run(),
      },
      {
        key: 'strike',
        title: t('DocsStrike'),
        icon: <StrikethroughS />,
        mark: 'strike',
        onClick: () => chain().toggleStrike().run(),
      },
      {
        key: 'code',
        title: t('DocsInlineCode'),
        icon: <Code />,
        mark: 'code',
        onClick: () => chain().toggleCode().run(),
      },
      {
        key: 'color',
        title: t('DocsTextColor'),
        icon: <FormatColorText />,
        active: !!editor.getAttributes('textStyle').color,
        onClick: (event) => setColorAnchor(event.currentTarget),
      },
      {
        key: 'highlight',
        title: t('DocsHighlight'),
        icon: <BorderColor />,
        mark: 'highlight',
        onClick: (event) => setHighlightAnchor(event.currentTarget),
      },
      {
        key: 'link',
        title: t('DocsLink'),
        icon: <LinkIcon />,
        mark: 'link',
        onClick: () => setLinkOpen(true),
      },
    ],
    [
      { key: 'left', title: t('DocsAlignLeft'), icon: <FormatAlignLeft />, align: 'left' },
      { key: 'center', title: t('DocsAlignCenter'), icon: <FormatAlignCenter />, align: 'center' },
      { key: 'right', title: t('DocsAlignRight'), icon: <FormatAlignRight />, align: 'right' },
      {
        key: 'justify',
        title: t('DocsAlignJustify'),
        icon: <FormatAlignJustify />,
        align: 'justify',
      },
    ],
    [
      {
        key: 'bullet',
        title: t('DocsBulletList'),
        icon: <FormatListBulleted />,
        node: 'bulletList',
        onClick: () => chain().toggleBulletList().run(),
      },
      {
        key: 'ordered',
        title: t('DocsOrderedList'),
        icon: <FormatListNumbered />,
        node: 'orderedList',
        onClick: () => chain().toggleOrderedList().run(),
      },
      {
        key: 'todo',
        title: t('DocsTodoList'),
        icon: <CheckBoxOutlined />,
        node: 'taskList',
        onClick: () => chain().toggleTaskList().run(),
      },
      {
        key: 'quote',
        title: t('DocsQuote'),
        icon: <FormatQuote />,
        node: 'blockquote',
        onClick: () => chain().toggleBlockquote().run(),
      },
      {
        key: 'codeBlock',
        title: t('DocsCodeBlock'),
        icon: <DataObject />,
        node: 'codeBlock',
        onClick: () => chain().toggleCodeBlock().run(),
      },
      {
        key: 'divider',
        title: t('DocsDivider'),
        icon: <HorizontalRule />,
        onClick: () => chain().setHorizontalRule().run(),
      },
    ],
  ];

  const isActive = (button: ToolbarItem) => {
    if (button.active !== undefined) return button.active;
    if (button.mark || button.node) return editor.isActive((button.mark || button.node)!);
    if (button.align) return editor.isActive({ textAlign: button.align });
    return false;
  };

  const handleClick = (button: ToolbarItem) => (event: MouseEvent<HTMLElement>) => {
    if (button.align) chain().setTextAlign(button.align).run();
    else button.onClick?.(event);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-8 py-4 border-b border-gray-200 dark:border-gray-700">
      <Select
        size="small"
        variant="standard"
        disableUnderline
        value={getBlockType(editor)}
        onChange={(event) => setBlockType(event.target.value)}
        className="min-w-136 px-8 text-sm"
        MenuProps={{ disableAutoFocusItem: true }}
      >
        <MenuItem value="p">{t('DocsParagraph')}</MenuItem>
        {HEADING_LEVELS.map((level) => (
          <MenuItem key={level} value={`h${level}`}>
            {t('DocsHeading', { level })}
          </MenuItem>
        ))}
      </Select>

      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-2">
          <Divider orientation="vertical" flexItem className="mx-4" />
          {group.map((button) => (
            <ToolbarButton
              key={button.key}
              title={button.title}
              active={isActive(button)}
              disabled={button.disabled}
              onClick={handleClick(button)}
            >
              {button.icon}
            </ToolbarButton>
          ))}
        </div>
      ))}
      <InsertMenu editor={editor} onUploadFiles={onUploadFiles} />

      <ColorMenu
        anchorEl={colorAnchor}
        colors={TEXT_COLORS}
        resetLabel={t('DocsDefaultColor')}
        onSelect={setColor}
        onClose={() => setColorAnchor(null)}
      />
      <ColorMenu
        anchorEl={highlightAnchor}
        colors={HIGHLIGHT_COLORS}
        resetLabel={t('DocsNoHighlight')}
        onSelect={setHighlight}
        onClose={() => setHighlightAnchor(null)}
      />
      {linkOpen && <LinkDialog editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  );
};

export default EditorToolbar;
