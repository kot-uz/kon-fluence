import { rtkBaseQuery } from '../adapters/transport';
import { mockBaseQuery } from '../mock/mockBaseQuery';

// Пока бекенда нет, мок включён по умолчанию. Для реального API: REACT_APP_DOCS_MOCK=false
export const isDocsMockEnabled = process.env.REACT_APP_DOCS_MOCK !== 'false';

export const docsBaseQuery = isDocsMockEnabled ? mockBaseQuery : rtkBaseQuery('/docs');
