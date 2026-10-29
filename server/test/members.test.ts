import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(() => env.close());

let counter = 0;
const signUp = async () => {
  const email = `m${++counter}@example.com`;
  const res = await env.app.inject({
    method: 'POST', url: '/auth/register',
    payload: { email, password: 'correct-horse', fullName: `Участник ${counter}` },
  });
  const { accessToken, user } = res.json();
  return { id: user.id as string, email, headers: { authorization: `Bearer ${accessToken}` } };
};

const createSpace = async (headers: Record<string, string>) =>
  (await env.app.inject({ method: 'POST', url: '/docs/Spaces', headers, payload: { title: 'S' } })).json().id as string;

describe('участники пространства', () => {
  it('владелец добавляет участника по email, тот видит пространство и список', async () => {
    const owner = await signUp();
    const guest = await signUp();
    const spaceId = await createSpace(owner.headers);

    const add = await env.app.inject({
      method: 'POST', url: `/docs/Spaces/${spaceId}/Members`, headers: owner.headers,
      payload: { email: guest.email.toUpperCase(), role: 'viewer' },
    });
    expect(add.statusCode).toBe(201);
    expect(add.json()).toMatchObject({ userId: guest.id, role: 'viewer' });

    const list = await env.app.inject({ method: 'GET', url: `/docs/Spaces/${spaceId}/Members`, headers: guest.headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((m: { role: string }) => m.role).sort()).toEqual(['owner', 'viewer']);

    const spaces = await env.app.inject({ method: 'GET', url: '/docs/Spaces', headers: guest.headers });
    expect(spaces.json().map((s: { id: string }) => s.id)).toContain(spaceId);
  });

  it('повторное добавление — 409, неизвестный email — 404, роль owner — 400', async () => {
    const owner = await signUp();
    const guest = await signUp();
    const spaceId = await createSpace(owner.headers);
    const url = `/docs/Spaces/${spaceId}/Members`;
    const post = (payload: object) => env.app.inject({ method: 'POST', url, headers: owner.headers, payload });

    expect((await post({ email: guest.email, role: 'editor' })).statusCode).toBe(201);
    expect((await post({ email: guest.email, role: 'viewer' })).statusCode).toBe(409);
    expect((await post({ email: 'nobody@example.com', role: 'viewer' })).statusCode).toBe(404);
    expect((await post({ email: guest.email, role: 'owner' })).statusCode).toBe(400);
  });

  it('управлять участниками может только владелец; чужому — 404', async () => {
    const owner = await signUp();
    const editor = await signUp();
    const stranger = await signUp();
    const spaceId = await createSpace(owner.headers);
    const url = `/docs/Spaces/${spaceId}/Members`;
    await env.app.inject({ method: 'POST', url, headers: owner.headers, payload: { email: editor.email, role: 'editor' } });

    const forbidden = await env.app.inject({
      method: 'POST', url, headers: editor.headers, payload: { email: stranger.email, role: 'viewer' },
    });
    expect(forbidden.statusCode).toBe(403);
    expect((await env.app.inject({ method: 'GET', url, headers: stranger.headers })).statusCode).toBe(404);
  });

  it('удаление участника лишает доступа; владельца удалить нельзя', async () => {
    const owner = await signUp();
    const guest = await signUp();
    const spaceId = await createSpace(owner.headers);
    const url = `/docs/Spaces/${spaceId}/Members`;
    await env.app.inject({ method: 'POST', url, headers: owner.headers, payload: { email: guest.email, role: 'viewer' } });

    const own = await env.app.inject({ method: 'DELETE', url: `${url}/${owner.id}`, headers: owner.headers });
    expect(own.statusCode).toBe(403);

    const del = await env.app.inject({ method: 'DELETE', url: `${url}/${guest.id}`, headers: owner.headers });
    expect(del.statusCode).toBe(204);
    expect((await env.app.inject({ method: 'GET', url, headers: guest.headers })).statusCode).toBe(404);
    expect((await env.app.inject({ method: 'DELETE', url: `${url}/${guest.id}`, headers: owner.headers })).statusCode).toBe(404);
  });
});
