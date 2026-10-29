import type { Space } from '../types';
import { getDb } from './db';
import type { StoredAttachment, StoredPage } from './db';

/** Пространство, которое создаётся само; пользовательским считается любое другое. */
export const DEFAULT_SPACE_ID = 'default';

/** Пользовательские данные на устройстве: то, что не воссоздаётся само при первом запуске. */
export interface LocalUserData {
  spaces: Space[];
  pages: StoredPage[];
  /** Названия всех пространств списка по ключу `${spaceType}:${id}`: у страниц своего названия нет. */
  spaceTitles: Record<string, string>;
  /** Вложения без самих файлов: Blob читается по одному при загрузке. */
  attachments: Omit<StoredAttachment, 'blob'>[];
}

export interface LocalUserDataStats {
  spaces: number;
  pages: number;
  attachments: number;
}

/** Демо-страница, которую пользователь не менял. */
const isUntouchedSeed = (page: StoredPage) => page.seed && page.version <= 1;

/**
 * Ищет в IndexedDB данные, которые стоит перенести в аккаунт: пространства кроме стандартного,
 * страницы без seed или изменённые (version > 1) и вложения.
 */
export const findLocalUserData = async (): Promise<LocalUserData> => {
  const db = await getDb();
  const [spaceList, allPages, allAttachments] = await Promise.all([
    db.getAll('spaceList'),
    db.getAll('pages'),
    db.getAll('attachments'),
  ]);

  const byId = new Map(allPages.map((page) => [page.id, page]));
  const picked = new Set(allPages.filter((page) => !isUntouchedSeed(page)).map((page) => page.id));
  // родитель нужен целым деревом: без него сервер отклонит страницу
  picked.forEach((id) => {
    for (let parentId = byId.get(id)?.parentId; parentId && !picked.has(parentId); ) {
      picked.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  });
  const pages = allPages.filter((page) => picked.has(page.id));
  const pageIds = picked;
  return {
    spaceTitles: Object.fromEntries(spaceList.map((space) => [`space:${space.id}`, space.title])),
    spaces: spaceList.filter((space) => space.id !== DEFAULT_SPACE_ID),
    pages,
    // вложение страницы, которой уже нет, переносить некуда
    attachments: allAttachments
      .filter((attachment) => pageIds.has(attachment.pageId))
      .map(({ blob: _blob, ...attachment }) => attachment),
  };
};

export const getUserDataStats = ({ spaces, pages, attachments }: LocalUserData): LocalUserDataStats => ({
  spaces: spaces.length,
  pages: pages.length,
  attachments: attachments.length,
});

export const hasUserData = (data: LocalUserData) =>
  data.spaces.length > 0 || data.pages.length > 0 || data.attachments.length > 0;
