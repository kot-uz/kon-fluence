import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spaceMembers, spaces } from '../src/db/schema';
import { requireSpaceRole } from '../src/plugins/space-role';
import { createTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv({
    setup: (app) => {
      app.register(async (instance) => {
        const spaceId = (request: { params: unknown }) => (request.params as { id: string }).id;
        instance.get('/t/viewer/:id', { preHandler: [app.authenticate, requireSpaceRole('viewer', spaceId)] }, async () => ({ ok: true }));
        instance.get('/t/editor/:id', { preHandler: [app.authenticate, requireSpaceRole('editor', spaceId)] }, async () => ({ ok: true }));
        instance.get('/t/owner/:id', { preHandler: [app.authenticate, requireSpaceRole('owner', spaceId)] }, async () => ({ ok: true }));
      });
    },
  });
});
afterAll(() => env.close());

let counter = 0;
const signUp = async () => {
  const res = await env.app.inject({
    method: 'POST', url: '/auth/register',
    payload: { email: `member${++counter}@example.com`, password: 'correct-horse', fullName: 'Участник' },
  });
  const { accessToken, user } = res.json();
  return { id: user.id as string, headers: { authorization: `Bearer ${accessToken}` } };
};

const createSpace = async (ownerId: string) => {
  const [space] = await env.db.insert(spaces).values({ type: 'space', title: 'S', ownerId }).returning();
  await env.db.insert(spaceMembers).values({ spaceId: space.id, userId: ownerId, role: 'owner' });
  return space;
};

const call = (role: string, id: string, headers: Record<string, string>) =>
  env.app.inject({ method: 'GET', url: `/t/${role}/${id}`, headers });

describe('requireSpaceRole', () => {
  it('роли упорядочены: viewer < editor < owner', async () => {
    const owner = await signUp();
    const viewer = await signUp();
    const space = await createSpace(owner.id);
    await env.db.insert(spaceMembers).values({ spaceId: space.id, userId: viewer.id, role: 'viewer' });

    expect((await call('viewer', space.id, viewer.headers)).statusCode).toBe(200);
    expect((await call('editor', space.id, viewer.headers)).statusCode).toBe(403);
    expect((await call('owner', space.id, owner.headers)).statusCode).toBe(200);
    expect((await call('editor', space.id, owner.headers)).statusCode).toBe(200);
  });

  it('404 для не-участника и для несуществующего пространства', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const space = await createSpace(owner.id);

    expect((await call('viewer', space.id, stranger.headers)).statusCode).toBe(404);
    const missing = await call('viewer', '00000000-0000-4000-8000-000000000000', owner.headers);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().code).toBe('NOT_FOUND');
  });

  it('404 для мягко удалённого пространства даже владельцу', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.id);
    await env.db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, space.id));
    expect((await call('viewer', space.id, owner.headers)).statusCode).toBe(404);
  });

  it('401 без токена', async () => {
    expect((await call('viewer', '00000000-0000-4000-8000-000000000000', {})).statusCode).toBe(401);
  });
});
