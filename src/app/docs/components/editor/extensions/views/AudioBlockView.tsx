import { AudioFile } from '@mui/icons-material';
import { useAttachmentUrl } from '../../../../hooks/useAttachmentUrl';
import {
  MediaBlockFrame,
  MediaStatus,
  selectNode,
  useStopEditorMouseDown,
} from './MediaBlockFrame';
import type { MediaViewProps } from './MediaBlockFrame';

const AudioBlockView = ({ node, editor, selected, deleteNode, getPos }: MediaViewProps) => {
  const { fileId, fileName } = node.attrs;
  const { url, isError } = useAttachmentUrl(fileId, true);
  const audioRef = useStopEditorMouseDown<HTMLAudioElement>(() => {
    if (editor.isEditable) selectNode(editor, getPos);
  });

  return (
    <MediaBlockFrame editor={editor} selected={selected} deleteNode={deleteNode}>
      <div className="docs-file-card docs-file-card--audio">
        <div className="docs-file-card__head">
          <AudioFile className="docs-file-card__icon" />
          <span className="docs-file-card__name" title={fileName}>
            {fileName}
          </span>
        </div>
        {url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio
            ref={audioRef}
            src={url}
            controls
            preload="metadata"
            className="w-full"
            aria-label={fileName}
          />
        ) : (
          <MediaStatus isError={isError} className="docs-audio-status" />
        )}
      </div>
    </MediaBlockFrame>
  );
};

export default AudioBlockView;
