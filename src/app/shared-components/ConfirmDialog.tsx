import type { ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import type { ButtonProps } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  title: ReactNode;
  text: ReactNode;
  confirmLabel?: ReactNode;
  confirmColor?: ButtonProps['color'];
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Подтверждение действия. Нужен там, где у модуля документации нет своего диалога:
 * удаление пространства и сброс демо-данных.
 */
const ConfirmDialog = ({
  title,
  text,
  confirmLabel,
  confirmColor = 'error',
  onConfirm,
  onClose,
}: ConfirmDialogProps) => {
  const { t } = useTranslation('translations');

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{text}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel || t('Delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
