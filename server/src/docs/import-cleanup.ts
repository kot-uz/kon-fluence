import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { attachments, importAttachments, imports } from '../db/schema';
import type { Storage } from '../storage/storage';

/**
 * Удаляет просроченные сессии импорта. Файлы незавершённых сессий (не привязанные к страницам)
 * удаляются из хранилища; у завершённых вложения уже принадлежат страницам и остаются.
 * Возвращает число удалённых сессий.
 */
export const cleanupExpiredImports = async (db: Db, storage: Storage, now = new Date()) => {
  const expired = await db.select({ id: imports.id }).from(imports).where(lt(imports.expiresAt, now));
  if (!expired.length) return 0;
  const ids = expired.map((row) => row.id);

  const orphans = await db
    .select({ id: attachments.id, storageKey: attachments.storageKey })
    .from(importAttachments)
    .innerJoin(attachments, eq(attachments.id, importAttachments.attachmentId))
    .where(and(inArray(importAttachments.importId, ids), isNull(attachments.pageId)));

  await db.transaction(async (tx) => {
    if (orphans.length) {
      await tx.delete(attachments).where(
        inArray(
          attachments.id,
          orphans.map((row) => row.id)
        )
      );
    }
    await tx.delete(imports).where(inArray(imports.id, ids));
  });
  await storage.delete(orphans.map((row) => row.storageKey));
  return ids.length;
};
