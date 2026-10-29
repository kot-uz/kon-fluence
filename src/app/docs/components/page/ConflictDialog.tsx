import moment from 'moment';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useDocsTranslation } from '../../adapters/platform';
import type { DocsPage } from '../../types';

export interface ConflictDialogProps {
  /** Актуальная версия страницы из ответа 409. */
  serverPage: DocsPage | null;
  isLoading: boolean;
  onReload: () => void;
  onOverwrite: () => void;
  onClose: () => void;
}

// 409 при публикации: страницу успели изменить. serverPage — актуальная версия из ответа.
const ConflictDialog = ({
  serverPage,
  isLoading,
  onReload,
  onOverwrite,
  onClose,
}: ConflictDialogProps) => {
  const { t } = useDocsTranslation();

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('DocsConflictTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('DocsConflictText', {
            name: serverPage?.updatedBy?.fullName || '—',
            date: serverPage?.updatedAt
              ? moment(serverPage.updatedAt).format('DD.MM.YYYY HH:mm')
              : '—',
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions className="flex-wrap gap-8">
        <Button onClick={onClose} disabled={isLoading}>
          {t('Cancel')}
        </Button>
        <Button variant="outlined" color="secondary" onClick={onReload} disabled={isLoading}>
          {t('DocsConflictReload')}
        </Button>
        <Button variant="contained" color="error" onClick={onOverwrite} disabled={isLoading}>
          {t('DocsConflictOverwrite')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictDialog;
