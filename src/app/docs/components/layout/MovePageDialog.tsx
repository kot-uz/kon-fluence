import { useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { handleError, useDocsTranslation, useNotify } from '../../adapters/platform';
import { useMoveDocsPageMutation } from '../../api/docsApi';
import { buildTree, getChildren, getDescendantIds, getPositionBetween } from '@kon-fluence/shared';
import type { DocsTreeItem, DocsTreeNode } from '../../types';

const ROOT = '__root__';
const FIRST = '__first__';
const LAST = '__last__';

/** Узел дерева с уровнем вложенности — для отступов в списке родителей. */
interface FlatNode extends DocsTreeNode {
  depth: number;
}

const flattenTree = (nodes: DocsTreeNode[], depth = 0): FlatNode[] =>
  nodes.flatMap((node) => [{ ...node, depth }, ...flattenTree(node.children, depth + 1)]);

export interface MovePageDialogProps {
  page: DocsTreeItem;
  items: DocsTreeItem[];
  onClose: () => void;
}

const MovePageDialog = ({ page, items, onClose }: MovePageDialogProps) => {
  const { t } = useDocsTranslation();
  const notify = useNotify();
  const [movePage, { isLoading }] = useMoveDocsPageMutation();

  const parentOptions = useMemo(() => {
    const excluded = getDescendantIds(items, page.id).add(page.id);
    return flattenTree(buildTree(items)).filter((item) => !excluded.has(item.id));
  }, [items, page.id]);

  const getSiblings = (parentId: string | null) =>
    getChildren(items, parentId).filter((item) => item.id !== page.id);

  // По умолчанию — текущее место страницы.
  const initialPlacement = () => {
    const siblings = getChildren(items, page.parentId);
    const index = siblings.findIndex((item) => item.id === page.id);
    return index > 0 ? siblings[index - 1].id : FIRST;
  };

  const [parent, setParent] = useState(page.parentId || ROOT);
  const [placement, setPlacement] = useState(initialPlacement);
  const parentId = parent === ROOT ? null : parent;
  const siblings = getSiblings(parentId);

  const handleParentChange = (event: { target: { value: string } }) => {
    setParent(event.target.value);
    setPlacement(LAST);
  };

  const getPosition = () => {
    if (placement === LAST)
      return getPositionBetween(siblings[siblings.length - 1]?.position, null);
    if (placement === FIRST) return getPositionBetween(null, siblings[0]?.position);
    const index = siblings.findIndex((item) => item.id === placement);
    return getPositionBetween(siblings[index]?.position, siblings[index + 1]?.position);
  };

  const handleSubmit = async () => {
    try {
      await movePage({ id: page.id, parentId, position: getPosition() }).unwrap();
      notify(t('DocsPageMoved'));
      onClose();
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('DocsMovePage')}: «{page.title}»
      </DialogTitle>
      <DialogContent className="flex flex-col gap-16 pt-8">
        <TextField
          select
          fullWidth
          margin="dense"
          label={t('DocsParentPage')}
          value={parent}
          onChange={handleParentChange}
        >
          <MenuItem value={ROOT}>{t('DocsRootLevel')}</MenuItem>
          {parentOptions.map((item) => (
            <MenuItem
              key={item.id}
              value={item.id}
              style={{ paddingLeft: 16 + (item.depth + 1) * 16 }}
            >
              {item.title}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          fullWidth
          label={t('DocsPlacement')}
          value={placement}
          onChange={(event) => setPlacement(event.target.value)}
        >
          <MenuItem value={FIRST}>{t('DocsPlaceFirst')}</MenuItem>
          {siblings.slice(0, -1).map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {t('DocsPlaceAfter', { title: item.title })}
            </MenuItem>
          ))}
          <MenuItem value={LAST}>{t('DocsPlaceLast')}</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" color="secondary" onClick={handleSubmit} disabled={isLoading}>
          {t('DocsMove')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MovePageDialog;
