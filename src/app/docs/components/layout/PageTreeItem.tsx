import type { KeyboardEvent, MouseEvent } from 'react';
import clsx from 'clsx';
import { IconButton, Tooltip } from '@mui/material';
import { Add, ChevronRight, DescriptionOutlined } from '@mui/icons-material';
import { useDocsTranslation } from '../../adapters/platform';
import { DOCS_MODE } from '../../constants';
import { useDocsContext } from '../../context/DocsContext';
import { DOCS_DIALOG, useDocsDialogs } from '../../context/DocsDialogsContext';
import type { DocsTreeNode } from '../../types';
import PageActionsMenu from './PageActionsMenu';

export interface PageTreeItemProps {
  node: DocsTreeNode;
  depth: number;
  activeId: string | null;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  onExpand: (id: string) => void;
}

const PageTreeItem = ({
  node,
  depth,
  activeId,
  isExpanded,
  onToggle,
  onExpand,
}: PageTreeItemProps) => {
  const { t } = useDocsTranslation();
  const { canEdit, navigate } = useDocsContext();
  const { openDialog } = useDocsDialogs();
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && isExpanded(node.id);
  const isActive = node.id === activeId;

  const openPage = () => navigate(node.id, DOCS_MODE.VIEW);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPage();
    } else if (hasChildren && event.key === (expanded ? 'ArrowLeft' : 'ArrowRight')) {
      onToggle(node.id);
    }
  };

  const handleAddSubpage = (event: MouseEvent) => {
    event.stopPropagation();
    onExpand(node.id);
    openDialog(DOCS_DIALOG.CREATE, { parentId: node.id });
  };

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={isActive}>
      <div
        className={clsx(
          'group flex items-center h-32 pr-4 rounded-md cursor-pointer select-none',
          isActive
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 font-medium'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        )}
        style={{ paddingLeft: depth * 16 + 4 }}
        role="button"
        tabIndex={0}
        onClick={openPage}
        onKeyDown={handleKeyDown}
      >
        <span className="flex items-center justify-center w-24 h-24 shrink-0">
          {hasChildren ? (
            <IconButton
              size="small"
              className="p-0"
              onClick={(event) => {
                event.stopPropagation();
                onToggle(node.id);
              }}
            >
              <ChevronRight
                fontSize="small"
                className={clsx('transition-transform', expanded && 'rotate-90')}
              />
            </IconButton>
          ) : (
            <DescriptionOutlined fontSize="small" className="opacity-50" />
          )}
        </span>
        <span className="flex-1 min-w-0 ml-4 text-sm truncate" title={node.title}>
          {node.title}
        </span>
        <span
          className={clsx(
            'flex items-center shrink-0',
            !isActive && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          )}
        >
          {canEdit && (
            <Tooltip title={t('DocsAddSubpage')}>
              <IconButton size="small" onClick={handleAddSubpage}>
                <Add fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <PageActionsMenu page={node} size="small" />
        </span>
      </div>
      {expanded && (
        <ul role="group">
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onExpand={onExpand}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default PageTreeItem;
