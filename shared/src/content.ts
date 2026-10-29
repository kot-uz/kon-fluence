const MAX_DEPTH = 64;
const MAX_NODES = 200_000;
const MAX_TYPE_LENGTH = 64;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Проверяет структуру содержимого страницы (JSON ProseMirror).
 * Возвращает текст первой найденной ошибки или null, если содержимое корректно.
 */
export const validateContent = (content: unknown): string | null => {
  let nodes = 0;

  const check = (node: unknown, path: string, depth: number): string | null => {
    if (!isPlainObject(node)) return `${path}: узел должен быть объектом`;
    if (depth > MAX_DEPTH) return `${path}: вложенность больше ${MAX_DEPTH}`;
    if (++nodes > MAX_NODES) return `${path}: слишком много узлов`;

    const { type, attrs, content: children, marks, text } = node;
    if (typeof type !== 'string' || !type || type.length > MAX_TYPE_LENGTH) {
      return `${path}.type: нужна непустая строка до ${MAX_TYPE_LENGTH} символов`;
    }
    if (attrs !== undefined && !isPlainObject(attrs)) return `${path}.attrs: должен быть объектом`;
    if (text !== undefined && typeof text !== 'string') return `${path}.text: должна быть строка`;
    if (marks !== undefined) {
      if (!Array.isArray(marks)) return `${path}.marks: должен быть массивом`;
      for (const [index, mark] of marks.entries()) {
        if (!isPlainObject(mark) || typeof mark.type !== 'string') return `${path}.marks[${index}]: нужен type`;
        if (mark.attrs !== undefined && !isPlainObject(mark.attrs)) return `${path}.marks[${index}].attrs: должен быть объектом`;
      }
    }
    if (children !== undefined) {
      if (!Array.isArray(children)) return `${path}.content: должен быть массивом`;
      for (const [index, child] of children.entries()) {
        const error = check(child, `${path}.content[${index}]`, depth + 1);
        if (error) return error;
      }
    }
    return null;
  };

  if (isPlainObject(content) && content.type !== 'doc') return 'content.type: корневой узел должен быть doc';
  return check(content, 'content', 0);
};
