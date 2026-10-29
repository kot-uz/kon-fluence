import { lazy } from 'react';
import type { ReactElement } from 'react';
import { authRoles } from './adapters/platform';

const DocsStandalone = lazy(() => import('./DocsStandalone'));

/** Роут модуля: путь относительно DOCS_BASE_PATH и элемент. */
export interface DocsRoute {
  path: string;
  element: ReactElement;
}

/** Конфиг модуля документации в формате, который ожидает хост-приложение. */
export interface DocsAppConfigShape {
  settings: { layout: Record<string, unknown> };
  auth: string[];
  routes: DocsRoute[];
}

// Роуты модуля документации: документация пространства на весь экран.
// Пример: /docs/space/Hk9_2bQ/<pageId> — документация пространства Hk9_2bQ.
// Пути относительные: префикс задаёт DOCS_BASE_PATH, см. src/app/App.tsx.
const DocsAppConfig: DocsAppConfigShape = {
  settings: {
    layout: {},
  },
  auth: authRoles.user,
  routes: [
    { path: ':spaceType/:spaceId', element: <DocsStandalone /> },
    { path: ':spaceType/:spaceId/:pageId', element: <DocsStandalone /> },
    { path: ':spaceType/:spaceId/:pageId/:mode', element: <DocsStandalone /> },
  ],
};

export default DocsAppConfig;
