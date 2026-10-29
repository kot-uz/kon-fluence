import { useEffect, useMemo, useState } from 'react';
import { useDocsTranslation } from '../../adapters/platform';
import { getSpaceKey } from '../../constants';
import { useDocsContext } from '../../context/DocsContext';
import { readStorage, writeStorage } from '../../utils/storage';
import { buildTree, filterTreeItems, getAncestors } from '../../utils/tree';
import type { DocsTreeItem } from '../../types';
import PageTreeItem from './PageTreeItem';

export interface PageTreeProps {
  items: DocsTreeItem[];
  activeId: string | null;
  search: string;
}

const PageTree = ({ items, activeId, search }: PageTreeProps) => {
  const { t } = useDocsTranslation();
  const { spaceType, spaceId } = useDocsContext();
  const storageKey = `docs-tree-expanded:${getSpaceKey(spaceType, spaceId)}`;
  const [expanded, setExpanded] = useState(() => new Set(readStorage<string[]>(storageKey, [])));

  const updateExpanded = (updater: (expanded: Set<string>) => Set<string>) =>
    setExpanded((prev) => {
      const next = updater(new Set(prev));
      writeStorage(storageKey, [...next]);
      return next;
    });

  // Раскрываем предков активной страницы, чтобы она была видна в дереве.
  useEffect(() => {
    if (!activeId) return;
    const ancestors = getAncestors(items, activeId);
    if (ancestors.some((item) => !expanded.has(item.id))) {
      updateExpanded((next) => {
        ancestors.forEach((item) => next.add(item.id));
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, items]);

  const isSearching = !!search.trim();
  const tree = useMemo(() => buildTree(filterTreeItems(items, search)), [items, search]);

  const toggle = (id: string) =>
    updateExpanded((next) => {
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isSearching && tree.length === 0) {
    return <p className="px-8 py-12 text-sm text-gray-500">{t('DocsNothingFound')}</p>;
  }

  return (
    <ul role="tree">
      {tree.map((node) => (
        <PageTreeItem
          key={node.id}
          node={node}
          depth={0}
          activeId={activeId}
          isExpanded={(id) => isSearching || expanded.has(id)}
          onToggle={toggle}
          onExpand={(id) => updateExpanded((next) => next.add(id))}
        />
      ))}
    </ul>
  );
};

export default PageTree;
