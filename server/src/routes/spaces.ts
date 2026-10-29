import { and, asc, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { pages, spaceMembers, spaces } from '../db/schema';
import { toTreeItem } from '../docs/pages';
import { notFound } from '../errors';
import { requireSpaceRole } from '../plugins/space-role';

const titleSchema = z.string().trim().min(1, 'Укажите название').max(255);

const spaceSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  createdAt: z.string(),
  role: z.enum(['owner', 'editor', 'viewer']),
});

const idParams = z.object({ id: z.uuid() });

export const spaceRoutes = async (rawApp: FastifyInstance) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();
  const { db } = app;
  const paramsSpaceId = (request: { params: unknown }) => (request.params as { id: string }).id;

  app.get(
    '/docs/Spaces',
    { onRequest: app.authenticate, schema: { response: { 200: z.array(spaceSchema) } } },
    async (request) => {
      const rows = await db
        .select({ space: spaces, role: spaceMembers.role })
        .from(spaceMembers)
        .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
        .where(and(eq(spaceMembers.userId, request.userId), eq(spaces.type, 'space'), isNull(spaces.deletedAt)))
        .orderBy(asc(spaces.createdAt));
      return rows.map(({ space, role }) => ({
        id: space.id,
        title: space.title,
        createdAt: space.createdAt.toISOString(),
        role,
      }));
    }
  );

  app.post(
    '/docs/Spaces',
    {
      onRequest: app.authenticate,
      schema: { body: z.object({ title: titleSchema }), response: { 201: spaceSchema } },
    },
    async (request, reply) => {
      const space = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(spaces)
          .values({ type: 'space', title: request.body.title, ownerId: request.userId })
          .returning();
        await tx.insert(spaceMembers).values({ spaceId: created.id, userId: request.userId, role: 'owner' });
        return created;
      });
      return reply
        .code(201)
        .send({ id: space.id, title: space.title, createdAt: space.createdAt.toISOString(), role: 'owner' as const });
    }
  );

  app.patch(
    '/docs/Spaces/:id',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('owner', paramsSpaceId),
      schema: { params: idParams, body: z.object({ title: titleSchema }), response: { 200: spaceSchema } },
    },
    async (request) => {
      const [space] = await db
        .update(spaces)
        .set({ title: request.body.title })
        .where(eq(spaces.id, request.params.id))
        .returning();
      return { id: space.id, title: space.title, createdAt: space.createdAt.toISOString(), role: 'owner' as const };
    }
  );

  // Мягкое удаление: страницы и вложения остаются в БД, но пространство становится недоступным.
  app.delete(
    '/docs/Spaces/:id',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('owner', paramsSpaceId),
      schema: { params: idParams },
    },
    async (request, reply) => {
      await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, request.params.id));
      return reply.code(204).send();
    }
  );

  app.get(
    '/docs/Spaces/:type/:id/Tree',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('viewer', paramsSpaceId),
      schema: {
        params: z.object({ type: z.enum(['space', 'project']), id: z.uuid() }),
        response: {
          200: z.array(
            z.object({ id: z.uuid(), parentId: z.uuid().nullable(), position: z.number(), title: z.string() })
          ),
        },
      },
    },
    async (request) => {
      const { type, id } = request.params;
      const [space] = await db.select({ type: spaces.type }).from(spaces).where(eq(spaces.id, id));
      if (space?.type !== type) throw notFound();
      const rows = await db.select().from(pages).where(eq(pages.spaceId, id)).orderBy(asc(pages.position), asc(pages.createdAt));
      return rows.map(toTreeItem);
    }
  );
};
