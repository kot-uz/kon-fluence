import { createContext, useContext } from 'react';
import type { DocsTreeItem } from '../types';

export const DOCS_DIALOG = {
  CREATE: 'create',
  RENAME: 'rename',
  MOVE: 'move',
  DELETE: 'delete',
} as const;

/** Тип открытого диалога страницы. */
export type DocsDialogType = (typeof DOCS_DIALOG)[keyof typeof DOCS_DIALOG];

/** Что передаётся в диалог: родитель для создания, сама страница — для остальных. */
export interface DocsDialogPayload {
  parentId?: string | null;
  page?: DocsTreeItem;
}

/** Состояние открытого диалога. */
export interface DocsDialogState extends DocsDialogPayload {
  type: DocsDialogType;
}

export interface DocsDialogsContextValue {
  openDialog: (type: DocsDialogType, payload?: DocsDialogPayload) => void;
}

export const DocsDialogsContext = createContext<DocsDialogsContextValue>({ openDialog: () => {} });

export const useDocsDialogs = () => useContext(DocsDialogsContext);
