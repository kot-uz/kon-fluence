import moment from 'moment';
import { Breadcrumbs, Button } from '@mui/material';
import { EditOutlined } from '@mui/icons-material';
import { useDocsTranslation } from '../../adapters/platform';
import { DOCS_MODE } from '../../constants';
import { useDocsContext } from '../../context/DocsContext';
import { getAncestors } from '../../utils/tree';
import type { DocsPage, DocsTreeItem } from '../../types';
import PageActionsMenu from './PageActionsMenu';

const formatDate = (date: string) => moment(date).format('DD.MM.YYYY HH:mm');

export interface PageHeaderProps {
  page: DocsPage;
  items: DocsTreeItem[];
}

const PageHeader = ({ page, items }: PageHeaderProps) => {
  const { t } = useDocsTranslation();
  const { canEdit, navigate } = useDocsContext();
  const ancestors = getAncestors(items, page.id);

  return (
    <header className="mb-24">
      <div className="flex items-start justify-between gap-16 min-h-32">
        <Breadcrumbs maxItems={5} className="text-sm pt-4">
          {ancestors.map((item) => (
            <button
              key={item.id}
              type="button"
              className="hover:underline"
              onClick={() => navigate(item.id, DOCS_MODE.VIEW)}
            >
              {item.title}
            </button>
          ))}
        </Breadcrumbs>
        <div className="flex items-center gap-8 shrink-0">
          {canEdit && (
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={<EditOutlined />}
              onClick={() => navigate(page.id, DOCS_MODE.EDIT)}
            >
              {t('Edit')}
            </Button>
          )}
          <PageActionsMenu page={page} />
        </div>
      </div>
      <h1 className="mt-8 text-4xl font-bold leading-tight break-words dark:text-white">
        {page.title}
      </h1>
      <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        {page.createdBy?.fullName && `${t('DocsCreatedBy')}: ${page.createdBy.fullName} · `}
        {t('DocsLastUpdated')}: {formatDate(page.updatedAt)}
        {page.updatedBy?.fullName && `, ${page.updatedBy.fullName}`}
      </p>
    </header>
  );
};

export default PageHeader;
