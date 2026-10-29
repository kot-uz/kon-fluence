import { Dialog, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useDocsTranslation } from '../../adapters/platform';

export interface ImageLightboxProps {
  url: string | null;
  alt?: string;
  caption?: string;
  onClose: () => void;
}

/** Полноэкранный просмотр картинки: закрывается по Esc, клику по фону или кнопке. */
const ImageLightbox = ({ url, alt, caption, onClose }: ImageLightboxProps) => {
  const { t } = useDocsTranslation();

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      PaperProps={{ sx: { bgcolor: 'rgba(0, 0, 0, 0.9)', boxShadow: 'none' }, onClick: onClose }}
    >
      <IconButton
        onClick={onClose}
        aria-label={t('Close')}
        className="absolute top-12 right-12 z-10 text-white bg-white/10 hover:bg-white/20"
      >
        <Close />
      </IconButton>
      <div className="flex flex-col items-center justify-center w-full h-full p-48 gap-16">
        {/* Клик по картинке не закрывает лайтбокс; с клавиатуры закрывается по Esc */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
        <img
          src={url ?? undefined}
          alt={alt}
          className="max-w-full max-h-full object-contain"
          onClick={(event) => event.stopPropagation()}
        />
        {caption && <p className="text-white/80 text-center">{caption}</p>}
      </div>
    </Dialog>
  );
};

export default ImageLightbox;
