import { deleteDB, openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Attachment, DocsPage, Space, SpaceKey } from '../types';

const DB_NAME = 'docs-local';
const LEGACY_DB_NAME = 'docs-mock';
const DB_VERSION = 2;

// Список пространств раньше лежал в localStorage; при апгрейде до v2 он переезжает в базу.
const LEGACY_SPACES_KEY = 'docs-spaces';

const DEFAULT_SPACES: Space[] = [{ id: 'default', title: 'Моя документация', createdAt: null }];

/** Страница в хранилище: к полям страницы добавлен ключ пространства для индекса. */
export interface StoredPage extends DocsPage {
  spaceKey: SpaceKey;
  /** Демо-страница, созданная при первом открытии пространства. */
  seed?: true;
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

export interface DocsLocalDb extends DBSchema {
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
  /** Список пространств для главной страницы. */
  spaceList: {
    key: string;
    value: Space;
  };
}

let dbPromise: Promise<IDBPDatabase<DocsLocalDb>> | null = null;

const readLegacySpaces = (): Space[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LEGACY_SPACES_KEY) ?? 'null');
    if (!Array.isArray(parsed)) return DEFAULT_SPACES;
    const spaces = (parsed as Space[]).filter((space) => space && typeof space.id === 'string');
    return spaces.length ? spaces : DEFAULT_SPACES;
  } catch {
    return DEFAULT_SPACES;
  }
};

const openLocalDb = () =>
  openDB<DocsLocalDb>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const pages = db.createObjectStore('pages', { keyPath: 'id' });
        pages.createIndex('spaceKey', 'spaceKey');
        const attachments = db.createObjectStore('attachments', { keyPath: 'id' });
        attachments.createIndex('pageId', 'pageId');
        db.createObjectStore('spaces', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        const spaceList = db.createObjectStore('spaceList', { keyPath: 'id' });
        readLegacySpaces().forEach((space) => spaceList.put(space));
      }
    },
  });

/**
 * Переносит данные из старой базы docs-mock в docs-local и удаляет старую.
 * Если docs-local уже есть, старую базу не трогаем: данные в ней могли устареть.
 */
const migrateLegacyDb = async () => {
  // indexedDB.databases() есть не во всех браузерах — там перенос пропускается
  if (!indexedDB.databases) return;
  const names = (await indexedDB.databases()).map((info) => info.name);
  if (!names.includes(LEGACY_DB_NAME) || names.includes(DB_NAME)) return;

  const legacy = await openDB<DocsLocalDb>(LEGACY_DB_NAME);
  const stores = ['pages', 'attachments', 'spaces'] as const;
  const hasStores = stores.every((store) => legacy.objectStoreNames.contains(store));
  const data = hasStores
    ? {
        pages: await legacy.getAll('pages'),
        attachments: await legacy.getAll('attachments'),
        spaces: await legacy.getAll('spaces'),
      }
    : null;
  legacy.close();

  const db = await openLocalDb();
  if (data) {
    const tx = db.transaction(stores, 'readwrite');
    data.pages.forEach((item) => tx.objectStore('pages').put(item));
    data.attachments.forEach((item) => tx.objectStore('attachments').put(item));
    data.spaces.forEach((item) => tx.objectStore('spaces').put(item));
    await tx.done;
  }
  db.close();
  await deleteDB(LEGACY_DB_NAME);
};

export const getDb = () => {
  if (!dbPromise) {
    dbPromise = migrateLegacyDb()
      .catch((error) => console.error('[docs local] legacy migration failed', error))
      .then(openLocalDb)
      .then((db) => {
        // список уже в базе: старый ключ больше не нужен
        try {
          localStorage.removeItem(LEGACY_SPACES_KEY);
        } catch {
          // недоступный localStorage не мешает работе
        }
        return db;
      });
  }
  return dbPromise;
};

/**
 * Полностью удаляет локальную базу: страницы, вложения и отметки о наполнении пространств.
 * При следующем открытии пространства оно будет наполнено демо-страницами заново.
 */
export const resetDocsLocalData = async () => {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
  await deleteDB(LEGACY_DB_NAME);
};
