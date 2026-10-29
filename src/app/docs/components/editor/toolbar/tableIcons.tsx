import { createSvgIcon } from '@mui/material';

// Иконки операций с таблицей (в @mui/icons-material подходящих нет).
// Контур рисуется вырезом: внешний прямоугольник по часовой, внутренний — против.
const outline = (x: number, y: number, w: number, h: number, s = 2) =>
  `M${x} ${y}h${w}v${h}H${x}z M${x + s} ${y + s}v${h - 2 * s}h${w - 2 * s}V${y + s}z`;

const plus = (cx: number, cy: number, r = 4) =>
  `M${cx - 1} ${cy - r}h2v${r - 1}h${r - 1}v2h${1 - r}v${r - 1}h-2v${1 - r}h${1 - r}v-2h${r - 1}z`;

const minus = (cx: number, cy: number, r = 3) => `M${cx - r} ${cy - 1}h${2 * r}v2h${-2 * r}z`;

const icon = (d: string, name: string) => createSvgIcon(<path d={d} />, name);

export const AddRowAboveIcon = icon(
  `${plus(12, 5)} ${outline(3, 11, 18, 10)} M11 11h2v10h-2z`,
  'AddRowAbove'
);
export const AddRowBelowIcon = icon(
  `${outline(3, 3, 18, 10)} M11 3h2v10h-2z ${plus(12, 19)}`,
  'AddRowBelow'
);
export const AddColLeftIcon = icon(
  `${plus(5, 12)} ${outline(11, 3, 10, 18)} M11 11h10v2H11z`,
  'AddColLeft'
);
export const AddColRightIcon = icon(
  `${outline(3, 3, 10, 18)} M3 11h10v2H3z ${plus(19, 12)}`,
  'AddColRight'
);
export const DeleteRowIcon = icon(`${outline(2, 8, 14, 8)} ${minus(20, 12)}`, 'DeleteRow');
export const DeleteColIcon = icon(`${outline(8, 2, 8, 14)} ${minus(12, 20)}`, 'DeleteCol');
export const HeaderRowIcon = icon(`${outline(3, 3, 18, 18)} M3 3h18v7H3z`, 'HeaderRow');
export const HeaderColIcon = icon(`${outline(3, 3, 18, 18)} M3 3h7v18H3z`, 'HeaderCol');
