import { useState } from 'react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { LayersClear } from '@mui/icons-material';
import { useDocsTranslation } from '../../../../adapters/platform';
import { CALLOUT_VARIANTS } from '../../../../constants';
import type { CalloutVariant } from '../../../../constants';
import { CALLOUT_ICONS, CALLOUT_TITLES } from '../../calloutVariants';

/**
 * Панель-callout. В редактировании иконка — кнопка смены варианта и снятия панели.
 */
const CalloutView = ({ editor, node, getPos, updateAttributes }: NodeViewProps) => {
  const { t } = useDocsTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const variant = node.attrs.variant as CalloutVariant;
  const Icon = CALLOUT_ICONS[variant] || CALLOUT_ICONS.info;
  const editable = editor.isEditable;

  const selectVariant = (value: CalloutVariant) => {
    setAnchorEl(null);
    updateAttributes({ variant: value });
  };

  // панель заменяется своим содержимым (lift зависел бы от того, где курсор)
  const removeCallout = () => {
    setAnchorEl(null);
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.replaceWith(pos, pos + node.nodeSize, node.content);
        return true;
      })
      .run();
  };

  return (
    <NodeViewWrapper className={`docs-callout docs-callout--${variant}`} data-variant={variant}>
      <div className="docs-callout__icon" contentEditable={false}>
        {editable ? (
          <button
            type="button"
            className="docs-callout__icon-button"
            title={t('DocsCalloutType')}
            aria-label={t('DocsCalloutType')}
            aria-haspopup="menu"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => setAnchorEl(event.currentTarget)}
          >
            <Icon fontSize="small" />
          </button>
        ) : (
          <Icon fontSize="small" />
        )}
      </div>
      <NodeViewContent className="docs-callout__content" />

      {editable && (
        <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
          {CALLOUT_VARIANTS.map((value) => {
            const VariantIcon = CALLOUT_ICONS[value];
            return (
              <MenuItem
                key={value}
                selected={value === variant}
                onClick={() => selectVariant(value)}
              >
                <ListItemIcon className={`docs-callout-icon--${value}`}>
                  <VariantIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t(CALLOUT_TITLES[value])}</ListItemText>
              </MenuItem>
            );
          })}
          <Divider />
          <MenuItem onClick={removeCallout}>
            <ListItemIcon>
              <LayersClear fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('DocsRemoveCallout')}</ListItemText>
          </MenuItem>
        </Menu>
      )}
    </NodeViewWrapper>
  );
};

export default CalloutView;
