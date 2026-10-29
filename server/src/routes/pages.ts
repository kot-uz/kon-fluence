import { setTaskChecked, validateContent, type DocContent } from '@kon-fluence/shared';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '../db/client';
import { attachments, pages, spaces } from '../db/schema';
import { getAuthorName, loadPage } from '../docs/pages';
import { AppError, notFound } from '../errors';
import { requireSpaceRole } from '../plugins/space-role';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const titleSchema = z.string().trim().min(1, 'Укажите название').max(255);

const contentSchema = z.custom<DocContent>().superRefine((value, ctx) => {
  const error = validateContent(value);
  if (error) ctx.addIssue({ code: 'custom', message: error });
});

const idParams = z.object({ id: z.uuid() });

/** Блокировка пространства на время транзакции: перемещения и вставки в нём идут по очереди. */
const lockSpace = async (tx: Tx, spaceId: string) => {
  await tx.select({ id: spaces.id }).from(spaces).where(eq(spaces.id, spaceId)).for('update');
};

const siblingsFilter = (spaceId: string, parentId: string | null) =>
  and(eq(pages.spaceId, spaceId), parentId ? eq(pages.parentId, parentId) : isNull(pages.parentId));

export const pageRoutes = async (rawApp: FastifyInstance) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();
  const { db } = app;

  /** Пространство страницы из `:id`; несуществующая страница — 404. */
  const pageSpaceId = async (request: FastifyRequest) => {
    const [row] = await db
      .select({ spaceId: pages.spaceId })
      .from(pages)
      .where(eq(pages.id, (request.params as { id: string }).id));
    if (!row) throw notFound();
    return row.spaceId;
  };
  const bodySpaceId = (request: FastifyRequest) => (request.body as { spaceId: string }).spaceId;

  const getPageOrThrow = async (id: string) => {
    const page = await loadPage(db, id);
    if (!page) throw notFound();
    return page;
  };

  app.get(
    '/docs/Pages/:id',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('viewer', pageSpaceId),
      schema: { params: idParams },
    },
    async (request) => getPageOrThrow(request.params.id)
  );

  app.post(
    '/docs/Pages',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('editor', bodySpaceId),
      schema: {
        body: z.object({
          spaceType: z.enum(['space', 'project']),
          spaceId: z.uuid(),
          parentId: z.uuid().nullish(),
          title: titleSchema,
          content: contentSchema.optional(),
        }),
      },
    },
    async (request, reply) => {
      const { spaceType, spaceId, title, content } = request.body;
      const parentId = request.body.parentId ?? null;
      const author = await getAuthorName(db, request.userId);

      const id = await db.transaction(async (tx) => {
        await lockSpace(tx, spaceId);
        const [space] = await tx.select({ type: spaces.type }).from(spaces).where(eq(spaces.id, spaceId));
        if (space?.type !== spaceType) throw notFound();
        if (parentId) {
          const [parent] = await tx
            .select({ id: pages.id })
            .from(pages)
            .where(and(eq(pages.id, parentId), eq(pages.spaceId, spaceId)));
          if (!parent) throw new AppError(400, 'PARENT_NOT_FOUND', 'Родительская страница не найдена');
        }
        const [{ last }] = await tx
          .select({ last: sql<number | null>`max(${pages.position})` })
          .from(pages)
          .where(siblingsFilter(spaceId, parentId));
        const [created] = await tx
          .insert(pages)
          .values({
            spaceId,
            parentId,
            position: (last ?? 0) + 1,
            title,
            content: content ?? { type: 'doc', content: [] },
            createdById: request.userId,
            createdByName: author,
            updatedById: request.userId,
            updatedByName: author,
          })
          .returning({ id: pages.id });
        return created.id;
      });
      return reply.code(201).send(await getPageOrThrow(id));
    }
  );

  app.put(
    '/docs/Pages/:id',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('editor', pageSpaceId),
      schema: {
        params: idParams,
        body: z.object({ version: z.number().int().positive(), title: titleSchema.optional(), content: contentSchema.optional() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { version, title, content } = request.body;
      const author = await getAuthorName(db, request.userId);

      // Оптимистическая блокировка: правка применяется, только если версия не изменилась.
      const [updated] = await db
        .update(pages)
        .set({
          ...(title && { title }),
          ...(content && { content }),
          version: sql`${pages.version} + 1`,
          updatedById: request.userId,
          updatedByName: author,
          updatedAt: new Date(),
        })
        .where(and(eq(pages.id, id), eq(pages.version, version)))
        .returning({ id: pages.id });

      if (!updated) {
        return reply.code(409).send({
          message: 'Страницу успели изменить',
          code: 'VERSION_CONFLICT',
          data: await getPageOrThrow(id),
        });
      }
      return getPageOrThrow(id);
    }
  );

  // Переименование не проверяет version: заголовок не конфликтует с редактированием содержимого.
  app.patch(
    '/docs/Pages/:id/Title',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('editor', pageSpaceId),
      schema: { params: idParams, body: z.object({ title: titleSchema }) },
    },
    async (request) => {
      const author = await getAuthorName(db, request.userId);
      await db
        .update(pages)
        .set({ title: request.body.title, updatedById: request.userId, updatedByName: author, updatedAt: new Date() })
        .where(eq(pages.id, request.params.id));
      return getPageOrThrow(request.params.id);
    }
  );

  app.patch(
    '/docs/Pages/:id/Move',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('editor', pageSpaceId),
      schema: {
        params: idParams,
        body: z.object({ parentId: z.uuid().nullable(), position: z.number().finite().optional() }),
      },
    },
    async (request) => {
      const { id } = request.params;
      const { parentId, position } = request.body;

      await db.transaction(async (tx) => {
        const [current] = await tx.select({ spaceId: pages.spaceId }).from(pages).where(eq(pages.id, id));
        if (!current) throw notFound();
        const { spaceId } = current;
        await lockSpace(tx, spaceId);

        if (parentId) {
          const [parent] = await tx
            .select({ id: pages.id })
            .from(pages)
            .where(and(eq(pages.id, parentId), eq(pages.spaceId, spaceId)));
          if (!parent) throw new AppError(400, 'PARENT_NOT_FOUND', 'Родительская страница не найдена');
          // Цикл: новый родитель — сама страница или её потомок.
          const cycle = await tx.execute(sql`
            WITH RECURSIVE subtree AS (
              SELECT id FROM pages WHERE id = ${id}
              UNION ALL
              SELECT p.id FROM pages p JOIN subtree s ON p.parent_id = s.id
            )
            SELECT 1 FROM subtree WHERE id = ${parentId}`);
          if (cycle.rows.length) {
            throw new AppError(400, 'MOVE_CYCLE', 'Нельзя переместить страницу в саму себя или в её подстраницу');
          }
        }

        const siblings = await tx
          .select({ id: pages.id, position: pages.position })
          .from(pages)
          .where(and(siblingsFilter(spaceId, parentId), ne(pages.id, id)))
          .orderBy(pages.position, pages.createdAt);
        const target = position ?? (siblings.length ? siblings[siblings.length - 1].position : 0) + 1;

        await tx.update(pages).set({ parentId, position: target }).where(eq(pages.id, id));

        // Позиция занята соседом: пересчитываем всех соседей в 1..n, страница встаёт перед равными.
        if (siblings.some((sibling) => sibling.position === target)) {
          const ordered = [
            ...siblings.filter((sibling) => sibling.position < target).map((sibling) => sibling.id),
            id,
            ...siblings.filter((sibling) => sibling.position >= target).map((sibling) => sibling.id),
          ];
          for (const [index, pageId] of ordered.entries()) {
            await tx.update(pages).set({ position: index + 1 }).where(eq(pages.id, pageId));
          }
        }
      });
      return getPageOrThrow(id);
    }
  );

  app.patch(
    '/docs/Pages/:id/Tasks/:taskId',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('editor', pageSpaceId),
      schema: {
        params: z.object({ id: z.uuid(), taskId: z.string().min(1).max(128) }),
        body: z.object({ checked: z.boolean() }),
      },
    },
    async (request) => {
      const { id, taskId } = request.params;
      const author = await getAuthorName(db, request.userId);

      // Блокировка строки: быстрые последовательные отметки не затирают друг друга.
      await db.transaction(async (tx) => {
        const [row] = await tx.select().from(pages).where(eq(pages.id, id)).for('update');
        if (!row) throw notFound();
        const content = structuredClone(row.content) as DocContent;
        if (!setTaskChecked(content, taskId, request.body.checked)) {
          throw new AppError(404, 'TASK_NOT_FOUND', 'Задача не найдена');
        }
        await tx
          .update(pages)
          .set({
            content,
            version: sql`${pages.version} + 1`,
            updatedById: request.userId,
            updatedByName: author,
            updatedAt: new Date(),
          })
          .where(eq(pages.id, id));
      });
      return getPageOrThrow(id);
    }
  );

  app.delete(
    '/docs/Pages/:id',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('editor', pageSpaceId),
      schema: { params: idParams },
    },
    async (request) => {
      const { id } = request.params;
      // Потомки и вложения удаляются каскадом по внешним ключам; id нужны для ответа.
      const { deletedIds, keys } = await db.transaction(async (tx) => {
        const result = await tx.execute<{ id: string }>(sql`
          WITH RECURSIVE subtree AS (
            SELECT id FROM pages WHERE id = ${id}
            UNION ALL
            SELECT p.id FROM pages p JOIN subtree s ON p.parent_id = s.id
          )
          SELECT id FROM subtree`);
        const ids = result.rows.map((row) => row.id);
        const files = await tx
          .select({ storageKey: attachments.storageKey })
          .from(attachments)
          .where(inArray(attachments.pageId, ids));
        await tx.delete(pages).where(eq(pages.id, id));
        return { deletedIds: ids, keys: files.map((file) => file.storageKey) };
      });
      // Файлы удаляются после коммита; сбой хранилища не должен отменять удаление страниц.
      await app.storage.delete(keys).catch((err) => request.log.error({ err }, 'не удалось удалить файлы вложений'));
      return { deletedIds };
    }
  );
};
