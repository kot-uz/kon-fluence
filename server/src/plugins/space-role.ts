import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { spaceMembers, spaces } from '../db/schema';
import { AppError, notFound } from '../errors';

export type SpaceRole = 'owner' | 'editor' | 'viewer';

const RANK: Record<SpaceRole, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * preHandler-фабрика: проверяет, что пользователь участвует в пространстве с ролью не ниже `minRole`.
 * Чужое или удалённое пространство отдаёт 404, чтобы не раскрывать его существование;
 * 403 — только участнику с недостаточной ролью. Должна идти после `app.authenticate`.
 */
export const requireSpaceRole =
  (minRole: SpaceRole, getSpaceId: (request: FastifyRequest) => string | Promise<string>) =>
  async (request: FastifyRequest) => {
    const spaceId = await getSpaceId(request);
    const [member] = await request.server.db
      .select({ role: spaceMembers.role })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, request.userId), isNull(spaces.deletedAt)));
    if (!member) throw notFound();
    if (RANK[member.role] < RANK[minRole]) throw new AppError(403, 'FORBIDDEN', 'Недостаточно прав');
  };
