import { nanoid } from 'nanoid';
import type { IDBPDatabase } from 'idb';
import type { User } from 'app/store/userSlice';
import { EMPTY_DOC, getSpaceKey } from '../constants';
import { setTaskChecked } from '../utils/tasks';
import { getChildren, getDescendantIds, getLastPosition } from '../utils/tree';
import type { Author, DocContent, DocsPage, DocsTreeItem, SpaceKey, SpaceType } from '../types';
import { getDb } from './db';
import type { DocsMockDb, StoredPage } from './db';
import { getSeedPages } from './seed';

type Db = IDBPDatabase<DocsMockDb>;

/** Запрос к моку: группы из URL, тело и текущий пользователь из store. */
export interface MockRequest<Body = unknown> {
  params: string[];
  body: Body;
  user?: User;
}

type MockHandler<Body> = (request: MockRequest<Body>) => Promise<unknown>;

/** Роут мока: метод, шаблон URL и обработчик. */
export type MockRoute = [method: string, pattern: RegExp, handler: MockHandler<never>];

// Тело своё у каждого обработчика; роут хранит его как never, чтобы оставаться одним типом.
const route = <Body>(method: string, pattern: RegExp, handler: MockHandler<Body>): MockRoute => [
  method,
  pattern,
  handler,
];

export class MockHttpError extends Error {
  readonly status: number;

  readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const now = () => new Date().toISOString();

const toAuthor = (user?: User): Author => ({
  id: user?.staffId ?? null,
  fullName: user?.fio || user?.fullName || '',
});

const toTreeItem = ({ id, parentId, position, title }: StoredPage): DocsTreeItem => ({
  id,
  parentId,
  position,
  title,
});

const toPage = ({ spaceKey: _spaceKey, ...page }: StoredPage): DocsPage => page;

const getPageOrThrow = async (db: Db, id: string) => {
  const page = await db.get('pages', id);
  if (!page) throw new MockHttpError(404, 'Page not found');
  return page;
};

const getSpacePages = (db: Db, spaceKey: SpaceKey) =>
  db.getAllFromIndex('pages', 'spaceKey', spaceKey);

/** Поля, из которых собирается новая страница. */
interface NewPage {
  spaceType: SpaceType;
  spaceId: string;
  parentId?: string | null;
  title?: string;
  content?: DocContent;
  position: number;
}

const buildPage = (
  { spaceType, spaceId, parentId, title, content, position }: NewPage,
  user?: User
): StoredPage => ({
  id: nanoid(),
  spaceKey: getSpaceKey(spaceType, spaceId),
  spaceType,
  spaceId: String(spaceId),
  parentId: parentId || null,
  position,
  title: title?.trim() || '',
  content: content || EMPTY_DOC,
  version: 1,
  createdBy: toAuthor(user),
  createdAt: now(),
  updatedBy: toAuthor(user),
  updatedAt: now(),
});

const seedSpaceIfNeeded = async (
  db: Db,
  spaceType: SpaceType,
  spaceId: string,
  user?: User
) => {
  const key = getSpaceKey(spaceType, spaceId);
  // Проверка внутри readwrite-транзакции: параллельные запросы не создадут seed дважды.
  const tx = db.transaction(['spaces', 'pages'], 'readwrite');
  if (await tx.objectStore('spaces').get(key)) {
    await tx.done;
    return;
  }
  getSeedPages().forEach((seed, index) =>
    tx.objectStore('pages').put(buildPage({ ...seed, spaceType, spaceId, position: index + 1 }, user))
  );
  tx.objectStore('spaces').put({ key, createdAt: now() });
  await tx.done;
};

const getTree = async ({ params: [spaceType, spaceId], user }: MockRequest) => {
  const db = await getDb();
  await seedSpaceIfNeeded(db, spaceType as SpaceType, spaceId, user);
  const pages = await getSpacePages(db, getSpaceKey(spaceType as SpaceType, spaceId));
  return pages.map(toTreeItem).sort((a, b) => a.position - b.position);
};

const getPage = async ({ params: [id] }: MockRequest) =>
  toPage(await getPageOrThrow(await getDb(), id));

/** Тело POST /Pages. */
interface CreatePageBody {
  spaceType: SpaceType;
  spaceId: string;
  parentId?: string | null;
  title?: string;
  content?: DocContent;
}

const createPage = async ({ body, user }: MockRequest<CreatePageBody>) => {
  const { spaceType, spaceId, parentId = null } = body;
  if (!body.title?.trim()) throw new MockHttpError(400, 'Title is required');
  const db = await getDb();
  const spacePages = await getSpacePages(db, getSpaceKey(spaceType, spaceId));
  if (parentId && !spacePages.some((page) => page.id === parentId)) {
    throw new MockHttpError(400, 'Parent page not found');
  }
  const page = buildPage({ ...body, position: getLastPosition(spacePages, parentId) + 1 }, user);
  await db.put('pages', page);
  return toPage(page);
};

/** Тело PUT /Pages/{id}. */
interface UpdatePageBody {
  version: number;
  title?: string;
  content?: DocContent;
}

const updatePage = async ({ params: [id], body, user }: MockRequest<UpdatePageBody>) => {
  const db = await getDb();
  const page = await getPageOrThrow(db, id);
  if (body.version !== page.version) {
    throw new MockHttpError(409, 'Page was changed by another user', toPage(page));
  }
  const updated: StoredPage = {
    ...page,
    title: body.title?.trim() || page.title,
    content: body.content ?? page.content,
    version: page.version + 1,
    updatedBy: toAuthor(user),
    updatedAt: now(),
  };
  await db.put('pages', updated);
  return toPage(updated);
};

const renamePage = async ({ params: [id], body, user }: MockRequest<{ title?: string }>) => {
  if (!body.title?.trim()) throw new MockHttpError(400, 'Title is required');
  const db = await getDb();
  const page = await getPageOrThrow(db, id);
  const updated: StoredPage = {
    ...page,
    title: body.title.trim(),
    updatedBy: toAuthor(user),
    updatedAt: now(),
  };
  await db.put('pages', updated);
  return toPage(updated);
};

// Отметка ToDo без version: чтение и запись в одной транзакции, чтобы быстрые
// последовательные отметки не затирали друг друга.
const toggleTask = async ({
  params: [id, taskId],
  body,
  user,
}: MockRequest<{ checked?: boolean }>) => {
  const db = await getDb();
  const tx = db.transaction('pages', 'readwrite');
  const page = await tx.store.get(id);
  if (!page) throw new MockHttpError(404, 'Page not found');
  if (!setTaskChecked(page.content, taskId, !!body.checked)) {
    throw new MockHttpError(404, 'Task not found');
  }
  const updated: StoredPage = {
    ...page,
    version: page.version + 1,
    updatedBy: toAuthor(user),
    updatedAt: now(),
  };
  await tx.store.put(updated);
  await tx.done;
  return toPage(updated);
};

/** Тело PATCH /Pages/{id}/Move. */
interface MovePageBody {
  parentId?: string | null;
  position?: number;
}

const movePage = async ({ params: [id], body }: MockRequest<MovePageBody>) => {
  const db = await getDb();
  const page = await getPageOrThrow(db, id);
  const parentId = body.parentId || null;
  const spacePages = await getSpacePages(db, page.spaceKey);
  if (parentId === id || (parentId && getDescendantIds(spacePages, id).has(parentId))) {
    throw new MockHttpError(400, 'Cannot move a page into itself or its subpage');
  }
  if (parentId && !spacePages.some((item) => item.id === parentId)) {
    throw new MockHttpError(400, 'Parent page not found');
  }
  const siblings = getChildren(spacePages, parentId).filter((item) => item.id !== id);
  const position =
    typeof body.position === 'number' ? body.position : getLastPosition(siblings, parentId) + 1;
  const updated: StoredPage = { ...page, parentId, position };
  await db.put('pages', updated);
  return toPage(updated);
};

const deletePage = async ({ params: [id] }: MockRequest) => {
  const db = await getDb();
  const page = await getPageOrThrow(db, id);
  const spacePages = await getSpacePages(db, page.spaceKey);
  const ids = [id, ...getDescendantIds(spacePages, id)];
  const tx = db.transaction(['pages', 'attachments'], 'readwrite');
  const attachments = tx.objectStore('attachments');
  await Promise.all(
    ids.map(async (pageId) => {
      const keys = await attachments.index('pageId').getAllKeys(pageId);
      await Promise.all(keys.map((key) => attachments.delete(key)));
      await tx.objectStore('pages').delete(pageId);
    })
  );
  await tx.done;
  return { deletedIds: ids };
};

export const routes: MockRoute[] = [
  route('GET', /^\/Spaces\/([^/]+)\/([^/]+)\/Tree$/, getTree),
  route('GET', /^\/Pages\/([^/]+)$/, getPage),
  route('POST', /^\/Pages$/, createPage),
  route('PUT', /^\/Pages\/([^/]+)$/, updatePage),
  route('PATCH', /^\/Pages\/([^/]+)\/Title$/, renamePage),
  route('PATCH', /^\/Pages\/([^/]+)\/Move$/, movePage),
  route('PATCH', /^\/Pages\/([^/]+)\/Tasks\/([^/]+)$/, toggleTask),
  route('DELETE', /^\/Pages\/([^/]+)$/, deletePage),
];
