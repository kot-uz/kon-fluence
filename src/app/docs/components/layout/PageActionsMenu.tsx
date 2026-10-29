import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import {
  Add,
  DeleteOutline,
  DriveFileMoveOutlined,
  DriveFileRenameOutline,
  LinkOutlined,
  MoreHoriz,
} from '@mui/icons-material';
import { useDocsTranslation, useNotify } from '../../adapters/platform';
import { useDocsContext } from '../../context/DocsContext';
import { DOCS_DIALOG, useDocsDialogs } from '../../context/DocsDialogsContext';
import { copyToClipboard } from '../../utils/clipboard';
import type { DocsTreeItem } from '../../types';

/** Пункт меню действий над страницей. */
interface ActionItem {
  key: string;
  icon: ReactNode;
  label: string;
  action: () => void;
}

export interface PageActionsMenuProps {
  page: DocsTreeItem;
  size?: 'small' | 'medium';
}

const PageActionsMenu = ({ page, size = 'medium' }: PageActionsMenuProps) => {
  const { t } = useDocsTranslation();
  const notify = useNotify();
  const { canEdit, getPageUrl } = useDocsContext();
  const { openDialog } = useDocsDialogs();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const run = (action: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    setAnchorEl(null);
    action();
  };

  const handleCopyLink = async () => {
    if (getPageUrl && (await copyToClipboard(getPageUrl(page.id)))) notify(t('DocsLinkCopied'));
  };

  const items = [
    canEdit && {
      key: 'add',
      icon: <Add fontSize="small" />,
      label: t('DocsAddSubpage'),
      action: () => openDialog(DOCS_DIALOG.CREATE, { parentId: page.id }),
    },
    canEdit && {
      key: 'rename',
      icon: <DriveFileRenameOutline fontSize="small" />,
      label: t('Rename'),
      action: () => openDialog(DOCS_DIALOG.RENAME, { page }),
    },
    canEdit && {
      key: 'move',
      icon: <DriveFileMoveOutlined fontSize="small" />,
      label: t('DocsMove'),
      action: () => openDialog(DOCS_DIALOG.MOVE, { page }),
    },
    getPageUrl && {
      key: 'link',
      icon: <LinkOutlined fontSize="small" />,
      label: t('DocsCopyLink'),
      action: handleCopyLink,
    },
  ].filter(Boolean) as ActionItem[];

  if (!items.length && !canEdit) return null;

  return (
    <>
      <IconButton size={size} onClick={handleOpen} aria-label="page actions">
        <MoreHoriz fontSize={size === 'small' ? 'small' : 'medium'} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={(event: object) => {
          // клик по фону меню не должен дойти до элемента дерева под ним
          (event as Partial<Event>).stopPropagation?.();
          setAnchorEl(null);
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => (
          <MenuItem key={item.key} onClick={run(item.action)}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
        {canEdit && <Divider />}
        {canEdit && (
          <MenuItem
            onClick={run(() => openDialog(DOCS_DIALOG.DELETE, { page }))}
            className="text-red-600"
          >
            <ListItemIcon>
              <DeleteOutline fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{t('Delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default PageActionsMenu;
