import TaskItem from '@tiptap/extension-task-item';
import type { NodeViewRenderer } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// Пункт ToDo со стабильным id: по нему отмечается выполнение в режиме просмотра
// (PATCH /Pages/{id}/Tasks/{taskId}) без отправки всего документа.
// Новым пунктам id не назначается в редакторе — его дозаполняет ensureTaskIds при публикации
// (заодно для старого контента и для дублей после копирования).
const TaskItemWithId = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        // новый пункт после Enter не должен унаследовать id исходного
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => (attributes.id ? { 'data-id': attributes.id } : {}),
      },
    };
  },

  // TipTap 2.x считает aria-label чекбокса до установки checked и в update берёт исходный node —
  // у выполненного пункта было «Не выполнено», а после правки текста — старый текст.
  addNodeView() {
    const createView = this.parent?.();
    // без node view у родителя узел рисуется обычным renderHTML — так было и до правки
    if (!createView) return null as unknown as NodeViewRenderer;

    return (props) => {
      const view = createView(props);
      const checkbox = view.dom.querySelector('input[type="checkbox"]');
      const setLabel = (node: ProseMirrorNode) => {
        const label = this.options.a11y?.checkboxLabel?.(node, !!node.attrs.checked);
        if (label && checkbox) checkbox.setAttribute('aria-label', label);
      };
      setLabel(props.node);

      return {
        ...view,
        update: (node, decorations, innerDecorations) => {
          const updated = view.update?.(node, decorations, innerDecorations) ?? false;
          if (updated) setLabel(node);
          return updated;
        },
      };
    };
  },
});

export default TaskItemWithId;
