import { and, eq, inArray, isNull, lt, notExists, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { attachments, importAttachments, pages } from '../db/schema';
import type { Storage } from '../storage/storage';

/** Свежие вложения не трогаем: файл загружают раньше, чем страница с ним сохраняется. */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

const BATCH_SIZE = 500;

/**
 * Удаляет осиротевшие вложения старше `graceMs`: файлы, на которые не ссылается содержимое страницы,
 * и файлы без страницы, которых нет ни в одной сессии импорта. Вложения незавершённого импорта
 * чистит `cleanupExpiredImports`. Возвращает число удалённых вложений.
 */
export const cleanupOrphanAttachments = async (db: Db, storage: Storage, now = new Date(), graceMs = ORPHAN_GRACE_MS) => {
  const threshold = new Date(now.getTime() - graceMs);
  let removed = 0;

  for (;;) {
    const orphans = await db
      .select({ id: attachments.id, storageKey: attachments.storageKey })
      .from(attachments)
      .leftJoin(pages, eq(pages.id, attachments.pageId))
      .where(
        and(
          lt(attachments.createdAt, threshold),
          or(
            // привязано к странице, но содержимое страницы больше не упоминает id файла
            and(
              sql`${attachments.pageId} is not null`,
              sql`position(${attachments.id}::text in ${pages.content}::text) = 0`
            ),
            // не привязано ни к странице, ни к сессии импорта
            and(
              isNull(attachments.pageId),
              notExists(
                db.select({ one: sql`1` }).from(importAttachments).where(eq(importAttachments.attachmentId, attachments.id))
              )
            )
          )
        )
      )
      .limit(BATCH_SIZE);
    if (!orphans.length) return removed;

    await db.delete(attachments).where(
      inArray(
        attachments.id,
        orphans.map((row) => row.id)
      )
    );
    await storage.delete(orphans.map((row) => row.storageKey));
    removed += orphans.length;
    if (orphans.length < BATCH_SIZE) return removed;
  }
};
