import { randomUUID } from 'node:crypto';
import multipart from '@fastify/multipart';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { attachments, pages } from '../db/schema';
import { AppError, notFound } from '../errors';
import { MEDIA_TTL_SECONDS, signMediaToken, verifyMediaToken } from '../auth/tokens';
import { requireSpaceRole } from '../plugins/space-role';

export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

// Типы, которые браузер безопасно показывает на месте; остальное отдаётся на скачивание.
const INLINE_MIME = /^(image\/(png|jpeg|gif|webp|avif|bmp)|application\/pdf|audio\/|video\/)/;

export const toAttachmentDto = (row: typeof attachments.$inferSelect) => ({
  id: row.id,
  pageId: row.pageId,
  fileName: row.fileName,
  mimeType: row.mimeType,
  size: row.size,
  createdAt: row.createdAt.toISOString(),
});

/** Одиночный диапазон `bytes=…`; `null` — заголовок игнорируется, `'invalid'` — 416. */
export const parseRange = (header: string | undefined, size: number) => {
  const match = header && /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, from, to] = match;
  if (!from && !to) return 'invalid' as const;
  let start: number;
  let end: number;
  if (!from) {
    // Суффикс: последние N байт.
    start = Math.max(size - Number(to), 0);
    end = size - 1;
  } else {
    start = Number(from);
    end = to ? Math.min(Number(to), size - 1) : size - 1;
  }
  if (start >= size || start > end) return 'invalid' as const;
  return { start, end };
};

const contentDisposition = (type: 'inline' | 'attachment', fileName: string) => {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
};

export const attachmentRoutes = async (rawApp: FastifyInstance, options: { jwtSecret: string }) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();
  const { db, storage } = app;

  await app.register(multipart, { limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 5 } });

  app.post('/docs/Attachments', { onRequest: app.authenticate }, async (request, reply) => {
    if (!request.isMultipart()) throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Ожидается multipart/form-data');
    const part = await request.file();
    if (!part) throw new AppError(400, 'FILE_REQUIRED', 'Файл не передан');

    // Поле pageId должно идти до файла: проверяем права, пока поток не начали читать.
    const pageField = part.fields.pageId;
    const rawPageId = pageField && !Array.isArray(pageField) && pageField.type === 'field' ? pageField.value : undefined;
    const pageId = z.uuid().safeParse(rawPageId);
    if (!pageId.success) throw new AppError(400, 'VALIDATION_ERROR', 'pageId: передайте поле до файла');

    const [page] = await db.select({ spaceId: pages.spaceId }).from(pages).where(eq(pages.id, pageId.data));
    if (!page) throw notFound();
    await requireSpaceRole('editor', () => page.spaceId)(request);

    const storageKey = `attachments/${randomUUID()}`;
    const mimeType = (part.mimetype || 'application/octet-stream').slice(0, 255);
    const size = await storage.put(storageKey, part.file, mimeType);
    if (part.file.truncated) {
      await storage.delete([storageKey]);
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Файл больше 100 МБ');
    }

    try {
      const [row] = await db
        .insert(attachments)
        .values({
          pageId: pageId.data,
          fileName: (part.filename || 'file').slice(0, 512),
          mimeType,
          size,
          storageKey,
          uploadedById: request.userId,
        })
        .returning();
      return reply.code(201).send(toAttachmentDto(row));
    } catch (err) {
      await storage.delete([storageKey]);
      throw err;
    }
  });

  /** Доступ к вложению: страница — участнику пространства; без страницы (импорт) — только загрузившему. */
  const assertCanView = async (request: FastifyRequest, row: typeof attachments.$inferSelect) => {
    if (row.pageId) {
      const [page] = await db.select({ spaceId: pages.spaceId }).from(pages).where(eq(pages.id, row.pageId));
      if (!page) throw notFound();
      await requireSpaceRole('viewer', () => page.spaceId)(request);
    } else if (row.uploadedById !== request.userId) {
      throw notFound();
    }
  };

  const findAttachment = async (id: string) => {
    const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
    if (!row) throw notFound();
    return row;
  };

  // Подписанная ссылка для <video>/<audio>, которые не умеют отправлять заголовок Authorization.
  app.post(
    '/docs/Attachments/:id/SignedUrl',
    {
      onRequest: app.authenticate,
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 200: z.object({ url: z.string(), expiresAt: z.string() }) },
      },
    },
    async (request) => {
      const row = await findAttachment(request.params.id);
      await assertCanView(request, row);
      const token = await signMediaToken(options.jwtSecret, row.id);
      return {
        url: `/docs/Attachments/${row.id}/Content?token=${token}`,
        expiresAt: new Date(Date.now() + MEDIA_TTL_SECONDS * 1000).toISOString(),
      };
    }
  );

  app.get(
    '/docs/Attachments/:id/Content',
    {
      schema: { params: z.object({ id: z.uuid() }), querystring: z.object({ token: z.string().optional() }) },
    },
    async (request, reply) => {
      const row = await findAttachment(request.params.id);
      if (request.query.token) {
        // Права проверены при выдаче ссылки; токен действует только для одного вложения.
        if ((await verifyMediaToken(options.jwtSecret, request.query.token)) !== row.id) {
          throw new AppError(401, 'UNAUTHORIZED', 'Ссылка недействительна или устарела');
        }
      } else {
        await app.authenticate(request);
        await assertCanView(request, row);
      }

      const range = parseRange(request.headers.range, row.size);
      if (range === 'invalid') {
        return reply
          .code(416)
          .header('Content-Range', `bytes */${row.size}`)
          .send({ message: 'Диапазон вне файла', code: 'RANGE_NOT_SATISFIABLE' });
      }

      const object = await storage.get(row.storageKey, range ?? undefined);
      reply
        .header('Accept-Ranges', 'bytes')
        .header('Content-Type', row.mimeType)
        .header('Content-Length', object.contentLength)
        .header('Content-Disposition', contentDisposition(INLINE_MIME.test(row.mimeType) ? 'inline' : 'attachment', row.fileName))
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Security-Policy', "sandbox; default-src 'none'")
        .header('Cache-Control', 'private, max-age=0, must-revalidate');
      if (range) reply.code(206).header('Content-Range', `bytes ${range.start}-${range.end}/${row.size}`);
      return reply.send(object.body);
    }
  );
};
