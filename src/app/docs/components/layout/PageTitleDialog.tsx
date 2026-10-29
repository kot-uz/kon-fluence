import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { handleError, useDocsTranslation, useNotify } from '../../adapters/platform';
import { useCreateDocsPageMutation, useRenameDocsPageMutation } from '../../api/docsApi';
import { DOCS_MODE, PAGE_TITLE_MAX_LENGTH } from '../../constants';
import { useDocsContext } from '../../context/DocsContext';
import { DOCS_DIALOG } from '../../context/DocsDialogsContext';
import type { DocsDialogState } from '../../context/DocsDialogsContext';

export interface PageTitleDialogProps {
  dialog: DocsDialogState;
  onClose: () => void;
}

const PageTitleDialog = ({ dialog, onClose }: PageTitleDialogProps) => {
  const { t } = useDocsTranslation();
  const notify = useNotify();
  const { spaceType, spaceId, navigate } = useDocsContext();
  const isRename = dialog.type === DOCS_DIALOG.RENAME;
  const [title, setTitle] = useState(isRename ? dialog.page?.title || '' : '');
  const [createPage, { isLoading: isCreating }] = useCreateDocsPageMutation();
  const [renamePage, { isLoading: isRenaming }] = useRenameDocsPageMutation();
  const isLoading = isCreating || isRenaming;
  const trimmed = title.trim();
  const createTitle = dialog.parentId ? t('DocsAddSubpage') : t('DocsCreatePage');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || isLoading) return;
    try {
      if (isRename && dialog.page) {
        await renamePage({ id: dialog.page.id, title: trimmed }).unwrap();
        notify(t('DocsPageRenamed'));
      } else {
        const page = await createPage({
          spaceType,
          spaceId,
          parentId: dialog.parentId || null,
          title: trimmed,
        }).unwrap();
        notify(t('DocsPageCreated'));
        navigate(page.id, DOCS_MODE.VIEW);
      }
      onClose();
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isRename ? t('DocsRenamePage') : createTitle}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={t('DocsPageTitle')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            inputProps={{ maxLength: PAGE_TITLE_MAX_LENGTH }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={!trimmed || isLoading}
          >
            {isRename ? t('Save') : t('Create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PageTitleDialog;
