import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Button,
  Card,
  CardActionArea,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { Add, Delete, Description, Edit, MoreVert } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'app/store/layout/messageSlice';
import { DOCS_BASE_PATH, SPACE_TYPES, useDeleteSpaceMutation, useGetSpacesQuery } from 'app/docs';
import type { Space } from 'app/docs';
import ConfirmDialog from 'app/shared-components/ConfirmDialog';
import SpaceTitleDialog from './SpaceTitleDialog';

/** Открытый диалог: создание нового пространства либо действие над существующим. */
type DialogState =
  | { mode: 'create' }
  | { mode: 'rename'; space: Space }
  | { mode: 'delete'; space: Space };

// Главная страница приложения: список пространств документации.
const SpacesPage = () => {
  const { t } = useTranslation('translations');
  const dispatch = useDispatch();
  const { data: spaces = [], isLoading } = useGetSpacesQuery();
  const [deleteSpace] = useDeleteSpaceMutation();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; space: Space } | null>(null);

  const closeMenu = () => setMenu(null);

  const confirmDelete = async (space: Space) => {
    try {
      await deleteSpace(space.id).unwrap();
      dispatch(showMessage({ message: t('AppSpaceDeleted') }));
    } catch {
      dispatch(showMessage({ message: t('AppSpaceError'), variant: 'error' }));
    }
  };

  return (
    <div className="flex-auto w-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-24 sm:p-32">
        <div className="flex flex-wrap items-center justify-between gap-16 mb-8">
          <Typography variant="h5" className="font-bold">
            {t('AppSpaces')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialog({ mode: 'create' })}
          >
            {t('AppCreateSpace')}
          </Button>
        </div>
        <Typography color="text.secondary" className="mb-24">
          {t('AppSpacesHint')}
        </Typography>

        {isLoading ? null : spaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-8 py-64 text-center">
            <Typography variant="h6">{t('AppNoSpaces')}</Typography>
            <Typography color="text.secondary">{t('AppNoSpacesHint')}</Typography>
          </div>
        ) : (
          <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => (
              <Card key={space.id} variant="outlined" className="flex items-stretch">
                <CardActionArea
                  component={Link}
                  to={`${DOCS_BASE_PATH}/${SPACE_TYPES.SPACE}/${space.id}`}
                  className="flex-1"
                >
                  <CardContent className="flex items-center gap-12 min-w-0">
                    <Description color="action" />
                    <Typography className="font-medium truncate" title={space.title}>
                      {space.title}
                    </Typography>
                  </CardContent>
                </CardActionArea>
                <IconButton
                  className="self-center mr-8"
                  aria-label={t('Settings')}
                  onClick={(event) => setMenu({ anchor: event.currentTarget, space })}
                >
                  <MoreVert />
                </IconButton>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menu) setDialog({ mode: 'rename', space: menu.space });
            closeMenu();
          }}
        >
          <Edit fontSize="small" className="mr-12" />
          {t('AppRenameSpace')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) setDialog({ mode: 'delete', space: menu.space });
            closeMenu();
          }}
        >
          <Delete fontSize="small" className="mr-12" />
          {t('AppDeleteSpace')}
        </MenuItem>
      </Menu>

      {dialog?.mode === 'delete' && (
        <ConfirmDialog
          title={t('AppDeleteSpace')}
          text={t('AppDeleteSpaceConfirm', { title: dialog.space.title })}
          onConfirm={() => confirmDelete(dialog.space)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog && dialog.mode !== 'delete' && (
        <SpaceTitleDialog {...dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
};

export default SpacesPage;
