import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  Description,
  Download,
  FolderZip,
  InsertDriveFile,
  PictureAsPdf,
  Slideshow,
  TableView,
} from '@mui/icons-material';
import { handleError, useDocsTranslation } from '../../../../adapters/platform';
import { downloadAttachment } from '../../../../api/attachmentsTransport';
import { formatSize, getExtension } from '../../../../utils/fileTypes';
import { MediaBlockFrame } from './MediaBlockFrame';
import type { MediaViewProps } from './MediaBlockFrame';

const ICONS_BY_EXTENSION: [string[], SvgIconComponent][] = [
  [['pdf'], PictureAsPdf],
  [['doc', 'docx', 'odt', 'rtf', 'txt', 'md'], Description],
  [['xls', 'xlsx', 'ods', 'csv'], TableView],
  [['ppt', 'pptx', 'odp'], Slideshow],
  [['zip', 'rar', '7z', 'tar', 'gz'], FolderZip],
];

const getFileIcon = (fileName: string) => {
  const ext = getExtension(fileName);
  return (
    ICONS_BY_EXTENSION.find(([extensions]) => extensions.includes(ext))?.[1] || InsertDriveFile
  );
};

const FileBlockView = ({ node, editor, selected, deleteNode }: MediaViewProps) => {
  const { t } = useDocsTranslation();
  const { fileId, fileName, size } = node.attrs;
  const [isDownloading, setIsDownloading] = useState(false);
  const Icon = getFileIcon(fileName);

  // файл не загружается заранее (может быть большим) — только по кнопке
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadAttachment(fileId, fileName);
    } catch (error) {
      handleError(error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <MediaBlockFrame editor={editor} selected={selected} deleteNode={deleteNode}>
      <div className="docs-file-card">
        <div className="docs-file-card__head">
          <Icon className="docs-file-card__icon" />
          <div className="min-w-0 flex-1">
            <div className="docs-file-card__name" title={fileName}>
              {fileName}
            </div>
            {!!size && <div className="docs-file-card__size">{formatSize(size)}</div>}
          </div>
          <Button
            size="small"
            variant="outlined"
            onClick={handleDownload}
            disabled={!fileId || isDownloading}
            startIcon={isDownloading ? <CircularProgress size={14} /> : <Download />}
          >
            {t('Download')}
          </Button>
        </div>
      </div>
    </MediaBlockFrame>
  );
};

export default FileBlockView;
