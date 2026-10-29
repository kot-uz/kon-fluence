import { useAttachmentUrl } from '../../../../hooks/useAttachmentUrl';
import {
  MediaBlockFrame,
  MediaCaption,
  MediaStatus,
  selectNode,
  useStopEditorMouseDown,
} from './MediaBlockFrame';
import type { MediaViewProps } from './MediaBlockFrame';

const VideoBlockView = ({
  node,
  editor,
  selected,
  updateAttributes,
  deleteNode,
  getPos,
}: MediaViewProps) => {
  const { fileId, fileName, caption } = node.attrs;
  const { url, isError } = useAttachmentUrl(fileId, true);
  // элементы управления видео должны работать и в редактировании
  const videoRef = useStopEditorMouseDown<HTMLVideoElement>(() => {
    if (editor.isEditable) selectNode(editor, getPos);
  });

  return (
    <MediaBlockFrame
      editor={editor}
      selected={selected}
      deleteNode={deleteNode}
      className="docs-video-block"
    >
      <figure className="m-0">
        {url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={url}
            controls
            preload="metadata"
            className="docs-video"
            aria-label={caption || fileName}
          />
        ) : (
          <MediaStatus isError={isError} className="docs-video docs-video--status" />
        )}
        <MediaCaption
          editor={editor}
          value={caption}
          onChange={(value) => updateAttributes({ caption: value })}
        />
      </figure>
    </MediaBlockFrame>
  );
};

export default VideoBlockView;
