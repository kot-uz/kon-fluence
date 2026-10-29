import { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'app/store/layout/messageSlice';
import { useCreateSpaceMutation, useRenameSpaceMutation } from 'app/docs';
import type { Space } from 'app/docs';

export interface SpaceTitleDialogProps {
  mode: 'create' | 'rename';
  space?: Space;
  onClose: () => void;
}

// Создание и переименование пространства: один диалог на оба случая, как в модуле документации.
const SpaceTitleDialog = ({ mode, space, onClose }: SpaceTitleDialogProps) => {
  const { t } = useTranslation('translations');
  const dispatch = useDispatch();
  const [title, setTitle] = useState(space?.title || '');
  const [error, setError] = useState(false);
  const [createSpace] = useCreateSpaceMutation();
  const [renameSpace] = useRenameSpaceMutation();

  const submit = async () => {
    const value = title.trim();
    if (!value) {
      setError(true);
      return;
    }
    try {
      if (mode === 'rename' && space) {
        await renameSpace({ id: space.id, title: value }).unwrap();
        dispatch(showMessage({ message: t('AppSpaceRenamed') }));
      } else {
        await createSpace({ title: value }).unwrap();
        dispatch(showMessage({ message: t('AppSpaceCreated') }));
      }
      onClose();
    } catch {
      dispatch(showMessage({ message: t('AppSpaceError'), variant: 'error' }));
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t(mode === 'rename' ? 'AppRenameSpace' : 'AppCreateSpace')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={t('AppSpaceTitle')}
          value={title}
          error={error}
          helperText={error ? t('AppSpaceTitleRequired') : ''}
          onChange={(event) => {
            setTitle(event.target.value);
            setError(false);
          }}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" onClick={submit}>
          {t(mode === 'rename' ? 'Save' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SpaceTitleDialog;
