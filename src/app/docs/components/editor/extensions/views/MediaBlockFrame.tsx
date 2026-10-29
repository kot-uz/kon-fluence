import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { Editor, NodeViewProps } from '@tiptap/react';
import clsx from 'clsx';
import { IconButton, Tooltip } from '@mui/material';
import { DeleteOutline, ErrorOutline } from '@mui/icons-material';
import { useDocsTranslation } from '../../../../adapters/platform';

/** Пропсы node view блока-вложения: то, что передаёт ReactNodeViewRenderer. */
export type MediaViewProps = NodeViewProps;

/**
 * mousedown внутри элемента не доходит до ProseMirror: иначе редактор перехватывает
 * клики по элементам управления <video>/<audio> и ручкам изменения размера
 * (выделяет узел, начинает перетаскивание). Нативный обработчик срабатывает раньше,
 * чем обработчик ProseMirror на корне редактора; React-обработчик — уже позже.
 * onMouseDown(event) вызывается вместо ProseMirror. Возвращает callback-ref:
 * элемент может появиться позже (например, <video> — после загрузки файла).
 */
export const useStopEditorMouseDown = <T extends HTMLElement>(
  onMouseDown?: (event: MouseEvent) => void
) => {
  const [element, setElement] = useState<T | null>(null);
  const handlerRef = useRef(onMouseDown);
  handlerRef.current = onMouseDown;

  useEffect(() => {
    if (!element) return undefined;
    const handleMouseDown = (event: MouseEvent) => {
      event.stopPropagation();
      handlerRef.current?.(event);
    };
    element.addEventListener('mousedown', handleMouseDown);
    return () => element.removeEventListener('mousedown', handleMouseDown);
  }, [element]);

  return setElement;
};

/** Выделить блок, не отдавая событие ProseMirror (клик по видео/аудио в редактировании). */
export const selectNode = (editor: Editor, getPos: () => number) => {
  const pos = getPos();
  if (typeof pos === 'number') editor.chain().setNodeSelection(pos).run();
};

export interface MediaBlockFrameProps {
  editor: Editor;
  selected: boolean;
  deleteNode: () => void;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Обёртка блока-вложения: рамка выделения, перетаскивание за любое место блока
 * и панель действий над выделенным блоком в режиме редактирования.
 */
export const MediaBlockFrame = ({
  editor,
  selected,
  deleteNode,
  actions,
  className,
  children,
}: MediaBlockFrameProps) => {
  const { t } = useDocsTranslation();
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper
      className={clsx('docs-media-block', editable && selected && 'is-selected', className)}
      data-drag-handle={editable ? '' : undefined}
    >
      {editable && selected && (
        <div className="docs-media-block__toolbar" contentEditable={false}>
          {actions}
          <Tooltip title={t('DocsDeleteBlock')}>
            <IconButton size="small" onClick={deleteNode}>
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      )}
      {children}
    </NodeViewWrapper>
  );
};

export interface MediaCaptionProps {
  editor: Editor;
  value?: string;
  onChange: (value: string) => void;
  /** Выравнивание текста (у картинки совпадает с её выравниванием). */
  align?: 'left' | 'center' | 'right';
}

/** Подпись под картинкой/видео: поле ввода в редактировании, текст в просмотре. */
export const MediaCaption = ({ editor, value, onChange, align = 'center' }: MediaCaptionProps) => {
  const { t } = useDocsTranslation();
  const style = { textAlign: align } as const;

  if (!editor.isEditable) {
    return value ? (
      <figcaption className="docs-media-block__caption" style={style}>
        {value}
      </figcaption>
    ) : null;
  }

  return (
    <input
      className="docs-media-block__caption docs-media-block__caption-input"
      style={style}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={t('DocsCaptionPlaceholder')}
      aria-label={t('DocsCaptionPlaceholder')}
    />
  );
};

/** Заглушка, пока вложение загружается, или если оно недоступно. */
export const MediaStatus = ({ isError, className }: { isError: boolean; className?: string }) => {
  const { t } = useDocsTranslation();

  if (isError) {
    return (
      <div className={clsx('docs-media-status docs-media-status--error', className)}>
        <ErrorOutline fontSize="small" />
        {t('DocsFileUnavailable')}
      </div>
    );
  }

  return <div className={clsx('docs-media-status animate-pulse', className)} />;
};
