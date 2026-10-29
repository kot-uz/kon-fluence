import type { JSONContent } from '@tiptap/react';
import type { DOCS_MODE, SPACE_TYPES } from './constants';

/** Тип сущности, к которой привязано пространство (см. constants.SPACE_TYPES). */
export type SpaceType = (typeof SPACE_TYPES)[keyof typeof SPACE_TYPES];

/** Режим страницы: просмотр или редактирование (см. constants.DOCS_MODE). */
export type DocsMode = (typeof DOCS_MODE)[keyof typeof DOCS_MODE];

/** Ключ пространства в хранилищах: `${spaceType}:${spaceId}` (см. constants.getSpaceKey). */
export type SpaceKey = string;

/** Содержимое страницы — документ ProseMirror в JSON. */
export type DocContent = JSONContent;

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

/** Узел дерева с вложенными детьми (см. utils/tree.buildTree). */
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

/** Локальный черновик страницы в режиме редактирования (localStorage). */
export interface PageDraft {
  title: string;
  content: DocContent;
  baseVersion: number;
  savedAt: string;
}

/** Текущий пользователь в терминах модуля документации (см. adapters/spaces). */
export interface DocsUser {
  id: string | undefined;
  fullName: string | undefined;
}

/** Информация о пространстве для отдельного роута (см. adapters/spaces.useSpaceInfo). */
export interface SpaceInfo {
  isLoading: boolean;
  notFound: boolean;
  title?: string;
  backUrl?: string;
  canEdit?: boolean;
}

/** Навигация по страницам: URL строит хост-приложение. */
export type DocsNavigate = (
  pageId: string | null,
  mode: DocsMode,
  options?: { replace?: boolean }
) => void;

/** Значение DocsContext — всё, что модуль знает о своём окружении. */
export interface DocsContextValue {
  spaceType: SpaceType;
  spaceId: string;
  pageId: string | null;
  mode: DocsMode;
  canEdit: boolean;
  currentUser?: DocsUser;
  navigate: DocsNavigate;
  getPageUrl?: (pageId: string) => string;
}
