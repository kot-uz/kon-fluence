import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import type { Editor } from '@tiptap/react';
import { useDocsTranslation } from '../../../adapters/platform';
import { isAllowedLink, normalizeLink } from '../../../utils/link';

export interface LinkDialogProps {
  editor: Editor;
  onClose: () => void;
}

const LinkDialog = ({ editor, onClose }: LinkDialogProps) => {
  const { t } = useDocsTranslation();
  const currentHref: string = editor.getAttributes('link').href || '';
  const [url, setUrl] = useState(currentHref);
  const href = normalizeLink(url);
  const isInvalid = !!href && !isAllowedLink(href);

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isInvalid) return;
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!href) {
      chain.unsetLink().run();
    } else if (editor.state.selection.empty && !editor.isActive('link')) {
      // нет выделенного текста — вставляем сам адрес как текст ссылки
      chain
        .insertContent({
          type: 'text',
          text: url.trim(),
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    onClose();
  };

  const handleRemove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <Dialog open onClose={close} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{t('DocsLink')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={t('DocsLinkUrl')}
            placeholder="https://"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            error={isInvalid}
            helperText={isInvalid ? t('DocsLinkInvalid') : ' '}
          />
        </DialogContent>
        <DialogActions>
          {currentHref && (
            <Button color="error" onClick={handleRemove} className="mr-auto">
              {t('DocsRemoveLink')}
            </Button>
          )}
          <Button onClick={close}>{t('Cancel')}</Button>
          <Button type="submit" variant="contained" color="secondary" disabled={isInvalid}>
            {t('Save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default LinkDialog;
