import { useMemo } from 'react';
import { DOCS_MODE } from './constants';
import { DocsContext } from './context/DocsContext';
import DocsLayout from './components/layout/DocsLayout';
import type { DocsMode, DocsNavigate, DocsUser, SpaceType } from './types';

export interface DocsSpaceProps {
  spaceType: SpaceType;
  spaceId: string;
  pageId?: string | null;
  mode?: DocsMode;
  canEdit?: boolean;
  currentUser?: DocsUser;
  /** onNavigate(pageId | null, mode, { replace }) — хост строит URL сам. */
  onNavigate: DocsNavigate;
  /** getPageUrl(pageId) — абсолютная ссылка на страницу (для «Копировать ссылку»). */
  getPageUrl?: (pageId: string) => string;
}

/**
 * Корневой компонент модуля документации. Ничего не знает о хост-приложении:
 * всё внешнее (пространство, права, навигация) приходит пропсами.
 */
const DocsSpace = ({
  spaceType,
  spaceId,
  pageId,
  mode = DOCS_MODE.VIEW,
  canEdit = false,
  currentUser,
  onNavigate,
  getPageUrl,
}: DocsSpaceProps) => {
  const value = useMemo(
    () => ({
      spaceType,
      spaceId: String(spaceId),
      pageId: pageId || null,
      mode,
      canEdit,
      currentUser,
      navigate: onNavigate,
      getPageUrl,
    }),
    [spaceType, spaceId, pageId, mode, canEdit, currentUser, onNavigate, getPageUrl]
  );

  return (
    <DocsContext.Provider value={value}>
      <DocsLayout />
    </DocsContext.Provider>
  );
};

export default DocsSpace;
