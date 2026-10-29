import { randomUUID } from 'node:crypto';
import multipart from '@fastify/multipart';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { attachments, importAttachments, imports, pages, spaceMembers, spaces } from '../db/schema';
import {
  IMPORT_TTL_MS,
  MAX_IMPORT_ATTACHMENTS,
  collectFileIds,
  commitBodySchema,
  orderPages,
  rewriteContent,
} from '../docs/import';
import { AppError, notFound } from '../errors';
import { MAX_ATTACHMENT_BYTES, toAttachmentDto } from './attachments';

// Commit несёт содержимое всех страниц, поэтому лимит тела выше общего.
const MAX_COMMIT_BODY_BYTES = 50 * 1024 * 1024;
const INSERT_CHUNK = 500;

const importParams = z.object({ importId: z.uuid() });

interface ImportResult {
  spaces: Record<string, string>;
  pages: Record<string, string>;
  attachments: Record<string, string>;
}

const chunks = <T>(items: T[]) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += INSERT_CHUNK) result.push(items.slice(i, i + INSERT_CHUNK));
  return result;
};

export const importRoutes = async (rawApp: FastifyInstance) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();
  const { db, storage } = app;

  await app.register(multipart, { limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 5 } });

  /** Сессия текущего пользователя; чужая или несуществующая — 404. */
  const getOwnImport = async (importId: string, userId: string) => {
    const [row] = await db
      .select()
      .from(imports)
      .where(and(eq(imports.id, importId), eq(imports.userId, userId)));
    if (!row) throw notFound();
    return row;
  };
  const expired = () => new AppError(410, 'IMPORT_EXPIRED', 'Сессия импорта истекла');

  app.post('/docs/Imports', { onRequest: app.authenticate }, async (request, reply) => {
    const [row] = await db
      .insert(imports)
      .values({ userId: request.userId, expiresAt: new Date(Date.now() + IMPORT_TTL_MS) })
      .returning({ id: imports.id });
    return reply.code(201).send({ importId: row.id });
  });

  app.post(
    '/docs/Imports/:importId/Attachments',
    { onRequest: app.authenticate, schema: { params: importParams } },
    async (request, reply) => {
      if (!request.isMultipart()) throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Ожидается multipart/form-data');
      const { importId } = request.params;
      const session = await getOwnImport(importId, request.userId);
      if (session.status !== 'open') throw new AppError(409, 'IMPORT_COMMITTED', 'Импорт уже завершён');
      if (session.expiresAt.getTime() < Date.now()) throw expired();

      const part = await request.file();
      if (!part) throw new AppError(400, 'FILE_REQUIRED', 'Файл не передан');
      // Поле localId должно идти до файла: повтор отсекается, не читая поток.
      const field = part.fields.localId;
      const rawLocalId = field && !Array.isArray(field) && field.type === 'field' ? field.value : undefined;
      const localId = z.string().min(1).max(255).safeParse(rawLocalId);
      if (!localId.success) throw new AppError(400, 'VALIDATION_ERROR', 'localId: передайте поле до файла');

      const findExisting = async () => {
        const [row] = await db
          .select({ attachment: attachments })
          .from(importAttachments)
          .innerJoin(attachments, eq(attachments.id, importAttachments.attachmentId))
          .where(and(eq(importAttachments.importId, importId), eq(importAttachments.localId, localId.data)));
        return row?.attachment;
      };
      const respond = (row: typeof attachments.$inferSelect, status: number) =>
        reply.code(status).send({ localId: localId.data, ...toAttachmentDto(row) });

      const existing = await findExisting();
      if (existing) {
        part.file.resume();
        return respond(existing, 200);
      }
      const [{ total }] = await db
        .select({ total: count() })
        .from(importAttachments)
        .where(eq(importAttachments.importId, importId));
      if (total >= MAX_IMPORT_ATTACHMENTS) {
        throw new AppError(413, 'TOO_MANY_FILES', `В сессии не больше ${MAX_IMPORT_ATTACHMENTS} файлов`);
      }

      const storageKey = `attachments/${randomUUID()}`;
      const mimeType = (part.mimetype || 'application/octet-stream').slice(0, 255);
      const size = await storage.put(storageKey, part.file, mimeType);
      if (part.file.truncated) {
        await storage.delete([storageKey]);
        throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Файл больше 100 МБ');
      }

      try {
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(attachments)
            .values({
              fileName: (part.filename || 'file').slice(0, 512),
              mimeType,
              size,
              storageKey,
              uploadedById: request.userId,
            })
            .returning();
          const linked = await tx
            .insert(importAttachments)
            .values({ importId, localId: localId.data, attachmentId: row.id })
            .onConflictDoNothing()
            .returning({ id: importAttachments.attachmentId });
          if (!linked.length) {
            // Параллельный повтор с тем же localId успел раньше: оставляем его файл.
            await tx.delete(attachments).where(eq(attachments.id, row.id));
            return null;
          }
          return row;
        });
        if (created) return respond(created, 201);
        await storage.delete([storageKey]);
        return respond((await findExisting())!, 200);
      } catch (err) {
        await storage.delete([storageKey]);
        throw err;
      }
    }
  );

  app.post(
    '/docs/Imports/:importId/Commit',
    {
      onRequest: app.authenticate,
      bodyLimit: MAX_COMMIT_BODY_BYTES,
      schema: { params: importParams, body: commitBodySchema },
    },
    async (request) => {
      const { importId } = request.params;
      const body = request.body;
      const userId = request.userId;

      const result = await db.transaction(async (tx): Promise<ImportResult> => {
        // Блокировка сессии: параллельные commit идут по очереди, второй увидит результат первого.
        const [session] = await tx
          .select()
          .from(imports)
          .where(and(eq(imports.id, importId), eq(imports.userId, userId)))
          .for('update');
        if (!session) throw notFound();
        if (session.status === 'committed') return session.result as ImportResult;
        if (session.expiresAt.getTime() < Date.now()) throw expired();

        const ordered = orderPages(body);

        const uploaded = await tx
          .select({ localId: importAttachments.localId, attachmentId: importAttachments.attachmentId })
          .from(importAttachments)
          .where(eq(importAttachments.importId, importId));
        const fileIds = new Map(uploaded.map((row) => [row.localId, row.attachmentId]));
        const fileOwner = new Map<string, string>();
        for (const page of body.pages) {
          for (const fileId of collectFileIds(page.content)) {
            if (!fileIds.has(fileId)) throw new AppError(400, 'FILE_NOT_FOUND', `Файл ${fileId} не загружен в эту сессию`);
          }
        }

        const spaceIds = new Map(body.spaces.map((space) => [space.localId, randomUUID()]));
        const pageIds = new Map(body.pages.map((page) => [page.localId, randomUUID()]));

        for (const group of chunks(body.spaces)) {
          await tx.insert(spaces).values(
            group.map((space) => ({
              id: spaceIds.get(space.localId)!,
              type: space.type,
              title: space.title,
              ownerId: userId,
              ...(space.createdAt && { createdAt: new Date(space.createdAt) }),
            }))
          );
          await tx
            .insert(spaceMembers)
            .values(group.map((space) => ({ spaceId: spaceIds.get(space.localId)!, userId, role: 'owner' as const })));
        }

        // Позиция по умолчанию — порядок страниц среди соседей в теле запроса.
        const nextPosition = new Map<string, number>();
        const rows = ordered.map((page) => {
          const siblings = `${page.spaceLocalId}/${page.parentLocalId ?? ''}`;
          const fallback = (nextPosition.get(siblings) ?? 0) + 1;
          nextPosition.set(siblings, fallback);
          const id = pageIds.get(page.localId)!;
          for (const fileId of collectFileIds(page.content)) if (!fileOwner.has(fileId)) fileOwner.set(fileId, id);
          const createdAt = page.createdAt ? new Date(page.createdAt) : new Date();
          return {
            id,
            spaceId: spaceIds.get(page.spaceLocalId)!,
            parentId: page.parentLocalId ? pageIds.get(page.parentLocalId)! : null,
            position: page.position ?? fallback,
            title: page.title,
            content: rewriteContent(page.content, fileIds, pageIds),
            createdById: userId,
            createdByName: page.createdByName ?? '',
            createdAt,
            updatedById: userId,
            updatedByName: page.updatedByName ?? page.createdByName ?? '',
            updatedAt: page.updatedAt ? new Date(page.updatedAt) : createdAt,
          };
        });
        for (const group of chunks(rows)) await tx.insert(pages).values(group);

        // Файл привязывается к первой странице, которая на него ссылается; неиспользованные удаляются ниже.
        for (const [localId, pageId] of fileOwner) {
          await tx.update(attachments).set({ pageId }).where(eq(attachments.id, fileIds.get(localId)!));
        }

        const attachmentsResult = Object.fromEntries(fileIds);
        const output: ImportResult = {
          spaces: Object.fromEntries(spaceIds),
          pages: Object.fromEntries(pageIds),
          attachments: attachmentsResult,
        };
        await tx.update(imports).set({ status: 'committed', result: output }).where(eq(imports.id, importId));
        return output;
      });

      await removeUnusedUploads(importId);
      return result;
    }
  );

  /** Загруженные в сессию, но не использованные в содержимом файлы удаляются из БД и хранилища. */
  const removeUnusedUploads = async (importId: string) => {
    const unused = await db
      .select({ id: attachments.id, storageKey: attachments.storageKey })
      .from(importAttachments)
      .innerJoin(attachments, eq(attachments.id, importAttachments.attachmentId))
      .where(and(eq(importAttachments.importId, importId), sql`${attachments.pageId} is null`));
    if (!unused.length) return;
    await db.delete(attachments).where(
      inArray(
        attachments.id,
        unused.map((row) => row.id)
      )
    );
    await storage.delete(unused.map((row) => row.storageKey)).catch((err) => app.log.error({ err }, 'не удалось удалить файлы импорта'));
  };
};
