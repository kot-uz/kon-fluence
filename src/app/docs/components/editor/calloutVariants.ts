import { CheckCircleOutline, ErrorOutline, InfoOutlined, WarningAmber } from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import type { CalloutVariant } from '../../constants';

export const CALLOUT_ICONS: Record<CalloutVariant, SvgIconComponent> = {
  info: InfoOutlined,
  success: CheckCircleOutline,
  warning: WarningAmber,
  error: ErrorOutline,
};

export const CALLOUT_TITLES: Record<CalloutVariant, string> = {
  info: 'DocsCalloutInfo',
  success: 'DocsCalloutSuccess',
  warning: 'DocsCalloutWarning',
  error: 'DocsCalloutError',
};
