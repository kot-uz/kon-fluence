import { readStorage, removeStorage, writeStorage } from 'app/docs/utils/storage';

/** Состояние переноса данных этого устройства в конкретный аккаунт. */
export interface ImportState {
  /**
   * skipped — «Не переносить», больше не спрашиваем;
   * started — перенос начат и не завершён, можно продолжить;
   * done — данные перенесены.
   */
  decision: 'skipped' | 'started' | 'done';
  /** Сессия импорта на сервере, пока перенос не завершён. */
  importId?: string;
  /** Локальные id вложений, уже загруженных в сессию. */
  uploaded?: string[];
}

const getKey = (userId: string) => `docs-import:${userId}`;

export const readImportState = (userId: string) =>
  readStorage<ImportState | null>(getKey(userId), null);

export const writeImportState = (userId: string, state: ImportState) =>
  writeStorage(getKey(userId), state);

export const clearImportState = (userId: string) => removeStorage(getKey(userId));
