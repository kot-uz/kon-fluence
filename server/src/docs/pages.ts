import { eq } from 'drizzle-orm';
import type { DocsPage, DocsTreeItem } from '@kon-fluence/shared';
import type { Db } from '../db/client';
import { pages, spaces, users } from '../db/schema';

export type PageRow = typeof pages.$inferSelect;

/** Имя автора правки: берётся из аккаунта по токену, а не из тела запроса. */
export const getAuthorName = async (db: Pick<Db, 'select'>, userId: string) => {
  const [user] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId));
  return user?.fullName ?? '';
};

export const toTreeItem = ({ id, parentId, position, title }: PageRow): DocsTreeItem => ({
  id,
  parentId,
  position,
  title,
});

export const toPage = (row: PageRow, spaceType: DocsPage['spaceType']): DocsPage => ({
  ...toTreeItem(row),
  spaceType,
  spaceId: row.spaceId,
  content: row.content as DocsPage['content'],
  version: row.version,
  createdBy: { id: row.createdById, fullName: row.createdByName },
  createdAt: row.createdAt.toISOString(),
  updatedBy: { id: row.updatedById, fullName: row.updatedByName },
  updatedAt: row.updatedAt.toISOString(),
});

/** Страница вместе с типом её пространства. */
export const loadPage = async (db: Pick<Db, 'select'>, id: string) => {
  const [row] = await db
    .select({ page: pages, spaceType: spaces.type })
    .from(pages)
    .innerJoin(spaces, eq(spaces.id, pages.spaceId))
    .where(eq(pages.id, id));
  return row ? toPage(row.page, row.spaceType) : null;
};
