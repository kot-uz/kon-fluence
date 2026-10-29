import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { handleError, useDocsTranslation, useNotify } from '../../adapters/platform';
import { useDeleteDocsPageMutation } from '../../api/docsApi';
import { DOCS_MODE } from '../../constants';
import { useDocsContext } from '../../context/DocsContext';
import { getDescendantIds } from '../../utils/tree';
import type { DocsTreeItem } from '../../types';

export interface DeletePageDialogProps {
  page: DocsTreeItem;
  items: DocsTreeItem[];
  onClose: () => void;
}

const DeletePageDialog = ({ page, items, onClose }: DeletePageDialogProps) => {
  const { t } = useDocsTranslation();
  const notify = useNotify();
  const { pageId, navigate } = useDocsContext();
  const [deletePage, { isLoading }] = useDeleteDocsPageMutation();
  const descendantIds = getDescendantIds(items, page.id);

  const handleDelete = async () => {
    try {
      await deletePage({ id: page.id }).unwrap();
      notify(t('DocsPageDeleted'));
      if (pageId === page.id || (pageId && descendantIds.has(pageId))) {
        navigate(page.parentId || null, DOCS_MODE.VIEW, { replace: true });
      }
      onClose();
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('DocsDeletePage')}</DialogTitle>
      <DialogContent>
        <p>{t('DocsDeleteConfirm', { title: page.title })}</p>
        {descendantIds.size > 0 && (
          <p className="mt-8 text-red-600">
            {t('DocsDeleteWithChildren', { number: descendantIds.size })}
          </p>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" color="error" onClick={handleDelete} disabled={isLoading}>
          {t('Delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeletePageDialog;
