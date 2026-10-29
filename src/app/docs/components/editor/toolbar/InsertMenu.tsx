import { useState } from 'react';
import { Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { Add } from '@mui/icons-material';
import type { Editor } from '@tiptap/react';
import { useDocsTranslation } from '../../../adapters/platform';
import type { UploadFiles } from '../../../hooks/useUploadFiles';
import { getInsertMenuItems, runBlockItem } from '../blockItems';
import type { LocalizedBlockItem } from '../blockItems';

export interface InsertMenuProps {
  editor: Editor;
  onUploadFiles: UploadFiles;
}

/** «+ Вставить»: таблица, вложения, панели. Те же блоки и команды, что в slash-меню. */
const InsertMenu = ({ editor, onUploadFiles }: InsertMenuProps) => {
  const { t } = useDocsTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const items = getInsertMenuItems(t);

  const handleSelect = (item: LocalizedBlockItem) => {
    setAnchorEl(null);
    runBlockItem(item, { editor, onFiles: onUploadFiles });
  };

  return (
    <>
      <Button
        size="small"
        color="inherit"
        startIcon={<Add />}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="menu"
        className="ml-4 normal-case"
      >
        {t('DocsInsert')}
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {/* плоский список: Menu не принимает Fragment среди детей */}
        {items.flatMap((item, index) => {
          const { Icon } = item;
          const startsGroup = index > 0 && item.group !== items[index - 1].group;
          const menuItem = (
            <MenuItem
              key={item.key}
              disabled={item.isDisabled?.(editor)}
              onClick={() => handleSelect(item)}
            >
              <ListItemIcon className={item.iconClassName}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          );
          return startsGroup ? [<Divider key={`${item.key}-divider`} />, menuItem] : [menuItem];
        })}
      </Menu>
    </>
  );
};

export default InsertMenu;
