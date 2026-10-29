import type { DocContent, SpaceType } from '@kon-fluence/shared';
import type { DOCS_MODE } from './constants';

export type {
  Attachment,
  Author,
  DocContent,
  DocsPage,
  DocsTreeItem,
  DocsTreeNode,
  Space,
  SpaceKey,
  SpaceMember,
  SpaceRole,
  SpaceType,
} from '@kon-fluence/shared';

/** Режим страницы: просмотр или редактирование (см. constants.DOCS_MODE). */
export type DocsMode = (typeof DOCS_MODE)[keyof typeof DOCS_MODE];

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
