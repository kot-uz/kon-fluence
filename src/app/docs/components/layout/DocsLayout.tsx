import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Drawer, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import type { Theme } from '@mui/material';
import { CloseFullscreen, MenuOpen, Menu as MenuIcon, OpenInFull } from '@mui/icons-material';
import { DocsLoading, useDocsTranslation } from '../../adapters/platform';
import { useGetDocsTreeQuery } from '../../api/docsApi';
import { DOCS_MODE, getSpaceKey, SIDEBAR_WIDTH } from '../../constants';
import { useDocsContext } from '../../context/DocsContext';
import { DocsDialogsContext } from '../../context/DocsDialogsContext';
import type { DocsDialogState, DocsDialogsContextValue } from '../../context/DocsDialogsContext';
import { getFirstPageId } from '@kon-fluence/shared';
import { readStorage, writeStorage } from '../../utils/storage';
import PageEdit from '../page/PageEdit';
import PageView from '../page/PageView';
import DocsDialogs from './DocsDialogs';
import DocsSidebar from './DocsSidebar';
import EmptySpace from './EmptySpace';

// ширина колонки — личная настройка, общая для всех пространств
const FULL_WIDTH_STORAGE_KEY = 'docs-full-width';

const DocsLayout = () => {
  const { t } = useDocsTranslation();
  const { spaceType, spaceId, pageId, mode, canEdit, navigate } = useDocsContext();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const sidebarStorageKey = `docs-sidebar-open:${getSpaceKey(spaceType, spaceId)}`;
  const [sidebarOpen, setSidebarOpen] = useState(() => readStorage(sidebarStorageKey, true));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fullWidth, setFullWidth] = useState(() => readStorage(FULL_WIDTH_STORAGE_KEY, false));
  const [dialog, setDialog] = useState<DocsDialogState | null>(null);

  const {
    data: items = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetDocsTreeQuery({ spaceType, spaceId });

  const pageExists = items.some((item) => item.id === pageId);

  // Без pageId или с несуществующей страницей открываем первую; edit без прав — в просмотр.
  useEffect(() => {
    if (isLoading || isFetching || isError) return;
    if (!pageId || !pageExists) {
      const firstId = getFirstPageId(items);
      if (firstId) navigate(firstId, DOCS_MODE.VIEW, { replace: true });
      else if (pageId) navigate(null, DOCS_MODE.VIEW, { replace: true });
      return;
    }
    if (mode === DOCS_MODE.EDIT && !canEdit) navigate(pageId, DOCS_MODE.VIEW, { replace: true });
  }, [isLoading, isFetching, isError, pageId, pageExists, items, mode, canEdit, navigate]);

  useEffect(() => {
    if (isMobile) setDrawerOpen(false);
  }, [pageId, isMobile]);

  const toggleSidebar = () => {
    if (isMobile) {
      setDrawerOpen((open) => !open);
      return;
    }
    setSidebarOpen((open) => {
      writeStorage(sidebarStorageKey, !open);
      return !open;
    });
  };

  const toggleFullWidth = () =>
    setFullWidth((value) => {
      writeStorage(FULL_WIDTH_STORAGE_KEY, !value);
      return !value;
    });

  const openDialog = useCallback<DocsDialogsContextValue['openDialog']>(
    (type, payload = {}) => setDialog({ type, ...payload }),
    []
  );
  const dialogsValue = useMemo(() => ({ openDialog }), [openDialog]);

  if (isLoading) return <DocsLoading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-16 p-24">
        <p className="text-lg">{t('DocsLoadError')}</p>
        <Button variant="outlined" color="secondary" onClick={refetch}>
          {t('DocsRetry')}
        </Button>
      </div>
    );
  }

  const sidebar = <DocsSidebar items={items} activeId={pageId} />;
  const isSidebarVisible = isMobile ? drawerOpen : sidebarOpen;

  return (
    <DocsDialogsContext.Provider value={dialogsValue}>
      <div className="flex w-full h-full min-h-0 bg-white dark:bg-dark">
        {isMobile ? (
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <div style={{ width: SIDEBAR_WIDTH }} className="h-full">
              {sidebar}
            </div>
          </Drawer>
        ) : (
          sidebarOpen && (
            <aside
              style={{ width: SIDEBAR_WIDTH }}
              className="shrink-0 h-full border-r border-gray-200 dark:border-gray-700"
            >
              {sidebar}
            </aside>
          )
        )}

        <main
          className={`relative flex-1 min-w-0 h-full overflow-y-auto ${
            fullWidth && !isMobile ? 'docs-full-width' : ''
          }`}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between h-0">
            <Tooltip title={t(isSidebarVisible ? 'DocsHideSidebar' : 'DocsShowSidebar')}>
              <IconButton size="small" className="m-8" onClick={toggleSidebar}>
                {isSidebarVisible ? <MenuOpen /> : <MenuIcon />}
              </IconButton>
            </Tooltip>
            {!isMobile && (
              <Tooltip title={t(fullWidth ? 'DocsFixedWidth' : 'DocsFullWidth')}>
                <IconButton
                  size="small"
                  className="m-8"
                  onClick={toggleFullWidth}
                  aria-pressed={fullWidth}
                >
                  {fullWidth ? (
                    <CloseFullscreen fontSize="small" />
                  ) : (
                    <OpenInFull fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </div>
          {items.length === 0 ? (
            <EmptySpace />
          ) : (
            pageExists &&
            pageId &&
            (mode === DOCS_MODE.EDIT && canEdit ? (
              <PageEdit key={`${pageId}:edit`} pageId={pageId} />
            ) : (
              <PageView key={pageId} pageId={pageId} items={items} />
            ))
          )}
        </main>
      </div>
      {dialog && <DocsDialogs dialog={dialog} items={items} onClose={() => setDialog(null)} />}
    </DocsDialogsContext.Provider>
  );
};

export default DocsLayout;
