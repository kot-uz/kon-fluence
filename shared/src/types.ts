/** Тип сущности, к которой привязано пространство: PROJECT — привязано к проекту, SPACE — самостоятельное. */
export const SPACE_TYPES = {
  PROJECT: 'project',
  SPACE: 'space',
} as const;

export type SpaceType = (typeof SPACE_TYPES)[keyof typeof SPACE_TYPES];

/** Ключ пространства в хранилищах: `${spaceType}:${spaceId}`. */
export type SpaceKey = string;

/** Узел документа ProseMirror в JSON (структурно совпадает с JSONContent из TipTap). */
export interface DocContent {
  type?: string;
  attrs?: Record<string, any>;
  content?: DocContent[];
  marks?: { type: string; attrs?: Record<string, any> }[];
  text?: string;
  [key: string]: any;
}

/** Автор создания или правки страницы. */
export interface Author {
  id: string | null;
  fullName: string;
}

/** Элемент дерева страниц: всё, что нужно сайдбару, без содержимого. */
export interface DocsTreeItem {
  id: string;
  parentId: string | null;
  position: number;
  title: string;
}

/** Узел дерева с вложенными детьми (см. buildTree). */
export interface DocsTreeNode extends DocsTreeItem {
  children: DocsTreeNode[];
}

/** Страница документации целиком. */
export interface DocsPage extends DocsTreeItem {
  spaceType: SpaceType;
  spaceId: string;
  content: DocContent;
  version: number;
  createdBy: Author;
  createdAt: string;
  updatedBy: Author;
  updatedAt: string;
}

/** Вложение страницы. Сам файл отдаётся отдельным запросом (Blob). */
export interface Attachment {
  id: string;
  pageId: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/** Пространство документации из списка (GET /Spaces). */
export interface Space {
  id: string;
  title: string;
  createdAt: string | null;
  /** Роль текущего пользователя; приходит только от бекенда. */
  role?: SpaceRole;
}

export type SpaceRole = 'owner' | 'editor' | 'viewer';

/** Участник пространства (GET /Spaces/{id}/Members). */
export interface SpaceMember {
  userId: string;
  email: string;
  fullName: string;
  role: SpaceRole;
}
