import type { DocsTreeItem, DocsTreeNode } from '../types';

/** Минимум, который нужен функциям дерева: id, parentId и position. */
type TreeLike = Pick<DocsTreeItem, 'id' | 'parentId' | 'position'>;

const byPosition = (a: TreeLike, b: TreeLike) => a.position - b.position;

export const getChildren = <T extends TreeLike>(items: T[] = [], parentId: string | null = null) =>
  items.filter((item) => (item.parentId ?? null) === (parentId ?? null)).sort(byPosition);

export const buildTree = (items: DocsTreeItem[] = []): DocsTreeNode[] => {
  const build = (parentId: string | null): DocsTreeNode[] =>
    getChildren(items, parentId).map((item) => ({ ...item, children: build(item.id) }));
  return build(null);
};

export const getAncestors = <T extends TreeLike>(items: T[] = [], id: string | null) => {
  const map = new Map(items.map((item) => [item.id, item]));
  const result: T[] = [];
  let current = id ? map.get(id) : undefined;
  while (current?.parentId && map.has(current.parentId)) {
    current = map.get(current.parentId);
    if (!current) break;
    result.unshift(current);
  }
  return result;
};

export const getDescendantIds = (items: TreeLike[] = [], id: string) => {
  const result = new Set<string>();
  const walk = (parentId: string) =>
    items.forEach((item) => {
      if (item.parentId === parentId && !result.has(item.id)) {
        result.add(item.id);
        walk(item.id);
      }
    });
  walk(id);
  return result;
};

export const getFirstPageId = (items: DocsTreeItem[] = []) => getChildren(items, null)[0]?.id ?? null;

export const getLastPosition = (items: TreeLike[] = [], parentId: string | null = null) => {
  const siblings = getChildren(items, parentId);
  return siblings.length ? siblings[siblings.length - 1].position : 0;
};

// Позиция для вставки между соседями: дробное число, чтобы перемещение меняло одну запись.
export const getPositionBetween = (before?: number | null, after?: number | null) => {
  if (before == null && after == null) return 1;
  if (before == null) return after! - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
};

export const filterTreeItems = (items: DocsTreeItem[] = [], search = '') => {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  const visible = new Set<string>();
  items.forEach((item) => {
    if (item.title.toLowerCase().includes(query)) {
      visible.add(item.id);
      getAncestors(items, item.id).forEach((ancestor) => visible.add(ancestor.id));
    }
  });
  return items.filter((item) => visible.has(item.id));
};
