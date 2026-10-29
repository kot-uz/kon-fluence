import { nanoid } from 'nanoid';
import type { DocContent } from './types';

const TASK_ITEM = 'taskItem';

const walk = (node: DocContent | null | undefined, visit: (node: DocContent) => boolean): boolean => {
  if (!node) return false;
  if (visit(node)) return true;
  return (node.content || []).some((child) => walk(child, visit));
};

/** Меняет `checked` пункта ToDo по id прямо в переданном JSON. Возвращает false, если пункт не найден. */
export const setTaskChecked = (doc: DocContent, taskId: string, checked: boolean) =>
  walk(doc, (node) => {
    if (node.type !== TASK_ITEM || node.attrs?.id !== taskId) return false;
    node.attrs!.checked = checked;
    return true;
  });

/**
 * Копия документа, где у каждого пункта ToDo есть уникальный id: пустые дозаполняются,
 * дубли (после копирования/вставки пунктов) получают новый id.
 */
export const ensureTaskIds = (doc: DocContent): DocContent => {
  const seen = new Set<string>();
  const visit = (node: DocContent): DocContent => {
    let next = node;
    if (node.type === TASK_ITEM) {
      const id: string | undefined = node.attrs?.id;
      const uniqueId = id && !seen.has(id) ? id : nanoid();
      seen.add(uniqueId);
      if (uniqueId !== id) next = { ...node, attrs: { ...node.attrs, id: uniqueId } };
    }
    return next.content ? { ...next, content: next.content.map(visit) } : next;
  };
  return visit(doc);
};
