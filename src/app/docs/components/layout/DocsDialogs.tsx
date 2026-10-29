import { DOCS_DIALOG } from '../../context/DocsDialogsContext';
import type { DocsDialogState } from '../../context/DocsDialogsContext';
import type { DocsTreeItem } from '../../types';
import DeletePageDialog from './DeletePageDialog';
import MovePageDialog from './MovePageDialog';
import PageTitleDialog from './PageTitleDialog';

export interface DocsDialogsProps {
  dialog: DocsDialogState;
  items: DocsTreeItem[];
  onClose: () => void;
}

const DocsDialogs = ({ dialog, items, onClose }: DocsDialogsProps) => {
  switch (dialog.type) {
    case DOCS_DIALOG.CREATE:
    case DOCS_DIALOG.RENAME:
      return <PageTitleDialog dialog={dialog} onClose={onClose} />;
    case DOCS_DIALOG.MOVE:
      return dialog.page ? (
        <MovePageDialog page={dialog.page} items={items} onClose={onClose} />
      ) : null;
    case DOCS_DIALOG.DELETE:
      return dialog.page ? (
        <DeletePageDialog page={dialog.page} items={items} onClose={onClose} />
      ) : null;
    default:
      return null;
  }
};

export default DocsDialogs;
