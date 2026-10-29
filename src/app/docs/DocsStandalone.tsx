import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Breadcrumbs, Typography } from '@mui/material';
import { DocsLoading, DocsPageLayout, useDocsTranslation } from './adapters/platform';
import { useCurrentUser, useSpaceInfo } from './adapters/spaces';
import { DOCS_BASE_PATH, DOCS_MODE } from './constants';
import DocsSpace from './DocsSpace';
import type { DocsMode, DocsNavigate, SpaceType } from './types';

// Документация пространства на весь экран: /docs/:spaceType/:spaceId[/:pageId[/edit]]
const DocsStandalone = () => {
  const { t } = useDocsTranslation();
  const { spaceType, spaceId, pageId, mode } = useParams();
  const navigate = useNavigate();
  const space = useSpaceInfo(spaceType, spaceId);
  const currentUser = useCurrentUser();

  const getPagePath = useCallback(
    (id: string | null, pageMode?: DocsMode) =>
      `${DOCS_BASE_PATH}/${spaceType}/${spaceId}${id ? `/${id}` : ''}${
        id && pageMode === DOCS_MODE.EDIT ? '/edit' : ''
      }`,
    [spaceType, spaceId]
  );

  const handleNavigate = useCallback<DocsNavigate>(
    (id, pageMode, options) => navigate(getPagePath(id, pageMode), options),
    [navigate, getPagePath]
  );

  const getPageUrl = useCallback(
    (id: string) => `${window.location.origin}${getPagePath(id, DOCS_MODE.VIEW)}`,
    [getPagePath]
  );

  const renderContent = () => {
    if (space.isLoading) return <DocsLoading />;
    if (space.notFound || !spaceType || !spaceId) {
      return (
        <div className="flex items-center justify-center h-full p-24">
          <Typography className="text-lg">{t('DocsSpaceNotFound')}</Typography>
        </div>
      );
    }
    return (
      <DocsSpace
        spaceType={spaceType as SpaceType}
        spaceId={spaceId}
        pageId={pageId}
        mode={mode === DOCS_MODE.EDIT ? DOCS_MODE.EDIT : DOCS_MODE.VIEW}
        canEdit={!!space.canEdit}
        currentUser={currentUser}
        onNavigate={handleNavigate}
        getPageUrl={getPageUrl}
      />
    );
  };

  return (
    <DocsPageLayout
      header={
        <Breadcrumbs className="px-24 py-12">
          {space.title && space.backUrl ? (
            <Link to={space.backUrl} className="hover:underline" style={{ color: 'inherit' }}>
              {space.title}
            </Link>
          ) : null}
          <Typography color="text.primary" className="font-semibold">
            {t('Documentation')}
          </Typography>
        </Breadcrumbs>
      }
      content={renderContent()}
      scroll="content"
    />
  );
};

export default DocsStandalone;
