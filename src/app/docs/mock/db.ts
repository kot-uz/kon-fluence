import { deleteDB, openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Attachment, DocsPage, SpaceKey } from '../types';

const DB_NAME = 'docs-mock';
const DB_VERSION = 1;

/** Страница в хранилище: к полям страницы добавлен ключ пространства для индекса. */
export interface StoredPage extends DocsPage {
  spaceKey: SpaceKey;
}

/** Вложение в хранилище: метаданные плюс сам файл. */
export interface StoredAttachment extends Attachment {
  blob: Blob;
}

/** Отметка о том, что пространство уже наполнено демо-страницами. */
export interface StoredSpace {
  key: SpaceKey;
  createdAt: string;
}

export interface DocsMockDb extends DBSchema {
  pages: {
    key: string;
    value: StoredPage;
    indexes: { spaceKey: SpaceKey };
  };
  attachments: {
    key: string;
    value: StoredAttachment;
    indexes: { pageId: string };
  };
  spaces: {
    key: SpaceKey;
    value: StoredSpace;
  };
}

let dbPromise: Promise<IDBPDatabase<DocsMockDb>> | null = null;

export const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<DocsMockDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const pages = db.createObjectStore('pages', { keyPath: 'id' });
        pages.createIndex('spaceKey', 'spaceKey');
        const attachments = db.createObjectStore('attachments', { keyPath: 'id' });
        attachments.createIndex('pageId', 'pageId');
        db.createObjectStore('spaces', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
};

/**
 * Полностью удаляет базу моков: страницы, вложения и отметки о наполнении пространств.
 * При следующем открытии пространства оно будет наполнено демо-страницами заново.
 */
export const resetDocsMockData = async () => {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
};
