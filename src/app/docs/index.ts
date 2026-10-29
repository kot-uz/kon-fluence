export { default as DocsSpace } from './DocsSpace';
export { docsApi } from './api/docsApi';
export {
  useGetSpacesQuery,
  useCreateSpaceMutation,
  useRenameSpaceMutation,
  useDeleteSpaceMutation,
  useGetSpaceMembersQuery,
  useAddSpaceMemberMutation,
  useRemoveSpaceMemberMutation,
} from './api/spacesApi';
export { SPACE_TYPES, DOCS_MODE, DOCS_BASE_PATH } from './constants';
export { default as DocsAppConfig } from './DocsAppConfig';
export { resetDocsLocalData } from './local/db';
// публичные типы модуля: ими описываются пропсы DocsSpace у хост-приложения
export type {
  DocsMode,
  DocsNavigate,
  DocsPage,
  DocsTreeItem,
  DocsUser,
  Space,
  SpaceInfo,
  SpaceMember,
  SpaceRole,
  SpaceType,
} from './types';
