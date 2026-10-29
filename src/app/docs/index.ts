export { default as DocsSpace } from './DocsSpace';
export { docsApi } from './api/docsApi';
export { isDocsMockEnabled } from './api/docsBaseQuery';
export { SPACE_TYPES, DOCS_MODE, DOCS_BASE_PATH } from './constants';
export { default as DocsAppConfig } from './DocsAppConfig';
export { resetDocsMockData } from './mock/db';
// публичные типы модуля: ими описываются пропсы DocsSpace у хост-приложения
export type {
  DocsMode,
  DocsNavigate,
  DocsPage,
  DocsTreeItem,
  DocsUser,
  SpaceInfo,
  SpaceType,
} from './types';
