import { Button } from '@mui/material';
import { Add, LibraryBooksOutlined } from '@mui/icons-material';
import { useDocsTranslation } from '../../adapters/platform';
import { useDocsContext } from '../../context/DocsContext';
import { DOCS_DIALOG, useDocsDialogs } from '../../context/DocsDialogsContext';

const EmptySpace = () => {
  const { t } = useDocsTranslation();
  const { canEdit } = useDocsContext();
  const { openDialog } = useDocsDialogs();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-12 p-24 text-center">
      <LibraryBooksOutlined className="text-64 opacity-30" />
      <p className="text-xl font-semibold">{t('DocsEmptySpace')}</p>
      {canEdit && (
        <>
          <p className="text-gray-500">{t('DocsEmptySpaceHint')}</p>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Add />}
            onClick={() => openDialog(DOCS_DIALOG.CREATE, { parentId: null })}
          >
            {t('DocsCreatePage')}
          </Button>
        </>
      )}
    </div>
  );
};

export default EmptySpace;
