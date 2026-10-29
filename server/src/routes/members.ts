import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { spaceMembers, users } from '../db/schema';
import { AppError, notFound } from '../errors';
import { requireSpaceRole } from '../plugins/space-role';

const memberSchema = z.object({
  userId: z.uuid(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(['owner', 'editor', 'viewer']),
});

const spaceParams = z.object({ id: z.uuid() });
const memberParams = z.object({ id: z.uuid(), userId: z.uuid() });

export const memberRoutes = async (rawApp: FastifyInstance) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();
  const { db } = app;
  const paramsSpaceId = (request: { params: unknown }) => (request.params as { id: string }).id;

  const listMembers = (spaceId: string) =>
    db
      .select({ userId: users.id, email: users.email, fullName: users.fullName, role: spaceMembers.role })
      .from(spaceMembers)
      .innerJoin(users, eq(users.id, spaceMembers.userId))
      .where(eq(spaceMembers.spaceId, spaceId))
      .orderBy(asc(users.fullName), asc(users.email));

  app.get(
    '/docs/Spaces/:id/Members',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('viewer', paramsSpaceId),
      schema: { params: spaceParams, response: { 200: z.array(memberSchema) } },
    },
    async (request) => listMembers(request.params.id)
  );

  // Владелец добавляет существующего пользователя по email; роль владельца выдать нельзя.
  app.post(
    '/docs/Spaces/:id/Members',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('owner', paramsSpaceId),
      schema: {
        params: spaceParams,
        body: z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), role: z.enum(['editor', 'viewer']) }),
        response: { 201: memberSchema },
      },
    },
    async (request, reply) => {
      const { email, role } = request.body;
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) throw notFound('Пользователь с таким email не найден');
      const inserted = await db
        .insert(spaceMembers)
        .values({ spaceId: request.params.id, userId: user.id, role })
        .onConflictDoNothing()
        .returning();
      if (!inserted.length) throw new AppError(409, 'ALREADY_MEMBER', 'Пользователь уже участвует в пространстве');
      return reply.code(201).send({ userId: user.id, email: user.email, fullName: user.fullName, role });
    }
  );

  app.delete(
    '/docs/Spaces/:id/Members/:userId',
    {
      onRequest: app.authenticate,
      preHandler: requireSpaceRole('owner', paramsSpaceId),
      schema: { params: memberParams },
    },
    async (request, reply) => {
      const { id, userId } = request.params;
      const [target] = await db
        .select({ role: spaceMembers.role })
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, id), eq(spaceMembers.userId, userId)));
      if (!target) throw notFound();
      if (target.role === 'owner') throw new AppError(403, 'FORBIDDEN', 'Владельца нельзя удалить');
      await db.delete(spaceMembers).where(and(eq(spaceMembers.spaceId, id), eq(spaceMembers.userId, userId)));
      return reply.code(204).send();
    }
  );
};
