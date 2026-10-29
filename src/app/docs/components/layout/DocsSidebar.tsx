import { useState } from 'react';
import { Button, InputAdornment, TextField } from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import { useDocsTranslation } from '../../adapters/platform';
import { useDocsContext } from '../../context/DocsContext';
import { DOCS_DIALOG, useDocsDialogs } from '../../context/DocsDialogsContext';
import type { DocsTreeItem } from '../../types';
import PageTree from './PageTree';

export interface DocsSidebarProps {
  items: DocsTreeItem[];
  activeId: string | null;
}

const DocsSidebar = ({ items, activeId }: DocsSidebarProps) => {
  const { t } = useDocsTranslation();
  const { canEdit } = useDocsContext();
  const { openDialog } = useDocsDialogs();
  const [search, setSearch] = useState('');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-16 pt-16 pb-8">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('DocsPages')}
        </span>
      </div>
      <div className="px-12 pb-8">
        <TextField
          size="small"
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('DocsSearchPages')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <PageTree items={items} activeId={activeId} search={search} />
      </div>
      {canEdit && (
        <div className="p-12 border-t border-gray-200 dark:border-gray-700">
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            startIcon={<Add />}
            onClick={() => openDialog(DOCS_DIALOG.CREATE, { parentId: null })}
          >
            {t('DocsCreatePage')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DocsSidebar;
