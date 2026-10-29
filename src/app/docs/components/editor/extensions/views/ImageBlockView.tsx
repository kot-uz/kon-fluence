import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import clsx from 'clsx';
import { Divider, IconButton, Tooltip } from '@mui/material';
import { FormatAlignCenter, FormatAlignLeft, FormatAlignRight } from '@mui/icons-material';
import { useDocsTranslation } from '../../../../adapters/platform';
import { IMAGE_WIDTHS } from '../../../../constants';
import { useAttachmentUrl } from '../../../../hooks/useAttachmentUrl';
import ImageLightbox from '../../../viewer/ImageLightbox';
import {
  MediaBlockFrame,
  MediaCaption,
  MediaStatus,
  useStopEditorMouseDown,
} from './MediaBlockFrame';
import type { MediaViewProps } from './MediaBlockFrame';

const MIN_WIDTH = 10;

/** Выравнивание картинки в колонке. */
type ImageAlign = 'left' | 'center' | 'right';

const ALIGNS: { value: ImageAlign; icon: ReactNode; title: string }[] = [
  { value: 'left', icon: <FormatAlignLeft fontSize="small" />, title: 'DocsAlignLeft' },
  { value: 'center', icon: <FormatAlignCenter fontSize="small" />, title: 'DocsAlignCenter' },
  { value: 'right', icon: <FormatAlignRight fontSize="small" />, title: 'DocsAlignRight' },
];

const clampWidth = (value: number) => Math.min(100, Math.max(MIN_WIDTH, Math.round(value)));

interface ResizeHandleProps {
  side: 'left' | 'right';
  align: ImageAlign;
  containerRef: RefObject<HTMLDivElement>;
  width: number;
  onPreview: (width: number) => void;
  onCommit: (width: number) => void;
}

/**
 * Ручка изменения ширины. side: 'left' | 'right'. Ширина считается в % от колонки;
 * у картинки по центру край смещается на половину изменения — поэтому множитель 2.
 */
const ResizeHandle = ({
  side,
  align,
  containerRef,
  width,
  onPreview,
  onCommit,
}: ResizeHandleProps) => {
  const ref = useStopEditorMouseDown<HTMLSpanElement>((event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const containerWidth = containerRef.current?.clientWidth;
    if (!containerWidth) return;
    const startX = event.clientX;
    const factor = (side === 'left' ? -1 : 1) * (align === 'center' ? 2 : 1);
    const getWidth = (clientX: number) =>
      clampWidth(width + (((clientX - startX) * factor) / containerWidth) * 100);

    const handleMove = (moveEvent: MouseEvent) => onPreview(getWidth(moveEvent.clientX));
    const handleUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      onCommit(getWidth(upEvent.clientX));
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  });

  return <span ref={ref} className={`docs-image__resize docs-image__resize--${side}`} />;
};

const ImageBlockView = ({
  node,
  editor,
  selected,
  updateAttributes,
  deleteNode,
}: MediaViewProps) => {
  const { t } = useDocsTranslation();
  const { fileId, fileName, alt, caption, width, align } = node.attrs;
  const { url, isError } = useAttachmentUrl(fileId);
  const editable = editor.isEditable;
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const currentWidth = previewWidth ?? width;

  const commitWidth = (value: number) => {
    setPreviewWidth(null);
    updateAttributes({ width: value });
  };

  const actions = (
    <>
      {IMAGE_WIDTHS.map((value) => (
        <Tooltip key={value} title={t('DocsImageWidth', { value })}>
          <button
            type="button"
            className={clsx('docs-media-block__width', width === value && 'is-active')}
            onClick={() => updateAttributes({ width: value })}
          >
            {value}%
          </button>
        </Tooltip>
      ))}
      <Divider orientation="vertical" flexItem className="mx-4" />
      {ALIGNS.map((item) => (
        <Tooltip key={item.value} title={t(item.title)}>
          <IconButton
            size="small"
            color={align === item.value ? 'secondary' : 'default'}
            onClick={() => updateAttributes({ align: item.value })}
          >
            {item.icon}
          </IconButton>
        </Tooltip>
      ))}
      <Divider orientation="vertical" flexItem className="mx-4" />
    </>
  );

  return (
    <MediaBlockFrame
      editor={editor}
      selected={selected}
      deleteNode={deleteNode}
      actions={actions}
      className="docs-image-block"
    >
      <figure className="m-0">
        <div ref={containerRef} className={`docs-image docs-image--${align}`}>
          <div className="docs-image__box" style={{ width: `${currentWidth}%` }}>
            {url ? (
              <img
                src={url}
                alt={alt || caption || fileName}
                className={clsx('docs-image__img', !editable && 'cursor-zoom-in')}
                draggable={false}
                {...(!editable && {
                  role: 'button',
                  tabIndex: 0,
                  onClick: () => setLightboxOpen(true),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setLightboxOpen(true);
                    }
                  },
                })}
              />
            ) : (
              <MediaStatus isError={isError} className="docs-image__status" />
            )}
            {editable && selected && url && (
              <>
                {(['left', 'right'] as const).map((side) => (
                  <ResizeHandle
                    key={side}
                    side={side}
                    align={align}
                    containerRef={containerRef}
                    width={width}
                    onPreview={setPreviewWidth}
                    onCommit={commitWidth}
                  />
                ))}
              </>
            )}
          </div>
        </div>
        <MediaCaption
          editor={editor}
          value={caption}
          align={align}
          onChange={(value) => updateAttributes({ caption: value })}
        />
      </figure>

      {lightboxOpen && (
        <ImageLightbox
          url={url}
          alt={alt || caption || fileName}
          caption={caption}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </MediaBlockFrame>
  );
};

export default ImageBlockView;
