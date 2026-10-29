import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { refreshTokens, users } from '../src/db/schema';
import { JWT_SECRET, cookieValue, createTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(() => env.close());

let counter = 0;
const newEmail = () => `user${++counter}@example.com`;
const PASSWORD = 'correct-horse';

const register = (email = newEmail(), password = PASSWORD, fullName = 'Иван Иванов') =>
  env.app.inject({ method: 'POST', url: '/auth/register', payload: { email, password, fullName } });

const login = (email: string, password = PASSWORD) =>
  env.app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });

const refresh = (token?: string) =>
  env.app.inject({ method: 'POST', url: '/auth/refresh', cookies: token ? { refresh_token: token } : {} });

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('register', () => {
  it('создаёт пользователя, отдаёт access-токен и httpOnly refresh-cookie', async () => {
    const res = await register('New@Example.com ');
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({ email: 'new@example.com', fullName: 'Иван Иванов' });
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.accessToken).toEqual(expect.any(String));

    const cookie = res.cookies.find((c) => c.name === 'refresh_token')!;
    expect(cookie).toMatchObject({ httpOnly: true, path: '/auth', sameSite: 'Lax' });
  });

  it('хранит argon2id-хэш, а не пароль', async () => {
    const email = newEmail();
    await register(email);
    const [user] = await env.db.select().from(users).where(eq(users.email, email));
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('409 для занятого email, в том числе в другом регистре', async () => {
    const email = newEmail();
    await register(email);
    const res = await register(email.toUpperCase());
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ message: expect.any(String), code: 'EMAIL_TAKEN' });
  });

  it.each([
    ['некорректный email', { email: 'nope', password: PASSWORD, fullName: 'A' }],
    ['короткий пароль', { email: 'a@example.com', password: 'short', fullName: 'A' }],
    ['пустое имя', { email: 'a@example.com', password: PASSWORD, fullName: '  ' }],
  ])('400: %s', async (_name, payload) => {
    const res = await env.app.inject({ method: 'POST', url: '/auth/register', payload });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });
});

describe('login', () => {
  it('входит с верным паролем', async () => {
    const email = newEmail();
    await register(email);
    const res = await login(email);
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toEqual(expect.any(String));
    expect(cookieValue(res)).toBeTruthy();
  });

  it('одинаковая 401 для неверного пароля и несуществующего email', async () => {
    const email = newEmail();
    await register(email);
    const wrongPassword = await login(email, 'wrong-password');
    const unknown = await login(newEmail());
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknown.json());
    expect(wrongPassword.json().code).toBe('INVALID_CREDENTIALS');
  });
});

describe('rate limit', () => {
  it('429 после превышения лимита на login', async () => {
    const limited = await createTestEnv({ rateLimitMax: 3 });
    try {
      const attempt = () =>
        limited.app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'x@example.com', password: 'whatever1' } });
      const codes = [];
      for (let i = 0; i < 5; i++) codes.push((await attempt()).statusCode);
      expect(codes).toEqual([401, 401, 401, 429, 429]);
      expect((await attempt()).json().code).toBe('TOO_MANY_REQUESTS');
    } finally {
      await limited.close();
    }
  });
});

describe('refresh', () => {
  it('ротирует токен: выдаёт новый, старый больше не работает', async () => {
    const first = cookieValue(await register())!;
    const res = await refresh(first);
    expect(res.statusCode).toBe(200);
    const second = cookieValue(res)!;
    expect(second).not.toBe(first);
    expect(res.json().accessToken).toEqual(expect.any(String));
    expect((await refresh(second)).statusCode).toBe(200);
  });

  it('401 без cookie и с неизвестным токеном', async () => {
    expect((await refresh()).statusCode).toBe(401);
    const res = await refresh('unknown-token');
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('повторное использование токена отзывает всю цепочку', async () => {
    const first = cookieValue(await register())!;
    const second = cookieValue(await refresh(first))!;

    expect((await refresh(first)).statusCode).toBe(401);
    // Легитимный держатель свежего токена тоже теряет сессию.
    expect((await refresh(second)).statusCode).toBe(401);
  });

  it('цепочки разных входов независимы', async () => {
    const email = newEmail();
    await register(email);
    const a = cookieValue(await login(email))!;
    const b = cookieValue(await login(email))!;

    await refresh(a);
    await refresh(a); // reuse: отзывается только цепочка a
    expect((await refresh(b)).statusCode).toBe(200);
  });

  it('401 для просроченного токена', async () => {
    const registered = await register();
    const token = cookieValue(registered)!;
    await env.db
      .update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(refreshTokens.userId, registered.json().user.id));

    const res = await refresh(token);
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('параллельные refresh одним токеном: успешен ровно один', async () => {
    const token = cookieValue(await register())!;
    const results = await Promise.all([refresh(token), refresh(token), refresh(token)]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
  });
});

describe('logout', () => {
  it('отзывает цепочку и очищает cookie', async () => {
    const token = cookieValue(await register())!;
    const rotated = cookieValue(await refresh(token))!;

    const res = await env.app.inject({ method: 'POST', url: '/auth/logout', cookies: { refresh_token: rotated } });
    expect(res.statusCode).toBe(204);
    expect(res.cookies.find((c) => c.name === 'refresh_token')?.value).toBe('');
    expect((await refresh(rotated)).statusCode).toBe(401);
  });

  it('204 и без cookie', async () => {
    expect((await env.app.inject({ method: 'POST', url: '/auth/logout' })).statusCode).toBe(204);
  });
});

describe('GET /auth/me', () => {
  it('отдаёт пользователя по access-токену', async () => {
    const email = newEmail();
    const { accessToken } = (await register(email)).json();
    const res = await env.app.inject({ method: 'GET', url: '/auth/me', headers: bearer(accessToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email, fullName: 'Иван Иванов' });
  });

  it('401 без токена, с мусором, с просроченным и с токеном другого секрета', async () => {
    const { user } = (await register()).json();
    const signed = (secret: string, exp: string | number) =>
      new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setExpirationTime(exp).sign(new TextEncoder().encode(secret));

    const cases: (Record<string, string>)[] = [
      {},
      bearer('garbage'),
      bearer(await signed(JWT_SECRET, Math.floor(Date.now() / 1000) - 60)),
      bearer(await signed('another-secret-0123456789abcdef012345', '15m')),
    ];
    for (const headers of cases) {
      const res = await env.app.inject({ method: 'GET', url: '/auth/me', headers });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('UNAUTHORIZED');
    }
  });
});

describe('PATCH /auth/me', () => {
  it('меняет имя', async () => {
    const { accessToken } = (await register()).json();
    const res = await env.app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: bearer(accessToken),
      payload: { fullName: 'Пётр Петров' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.fullName).toBe('Пётр Петров');
    expect(res.json().accessToken).toBeUndefined();
  });

  it('смена пароля требует верный текущий пароль', async () => {
    const { accessToken } = (await register()).json();
    const missing = await env.app.inject({
      method: 'PATCH', url: '/auth/me', headers: bearer(accessToken), payload: { newPassword: 'new-password-1' },
    });
    expect(missing.statusCode).toBe(400);

    const wrong = await env.app.inject({
      method: 'PATCH', url: '/auth/me', headers: bearer(accessToken),
      payload: { currentPassword: 'wrong-password', newPassword: 'new-password-1' },
    });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().code).toBe('INVALID_PASSWORD');
  });

  it('смена пароля отзывает все refresh-токены, текущая сессия получает новый', async () => {
    const email = newEmail();
    const registered = await register(email);
    const otherDevice = cookieValue(await login(email))!;
    const thisDevice = cookieValue(registered)!;

    const res = await env.app.inject({
      method: 'PATCH', url: '/auth/me', headers: bearer(registered.json().accessToken),
      payload: { currentPassword: PASSWORD, newPassword: 'new-password-1' },
    });
    expect(res.statusCode).toBe(200);
    const fresh = cookieValue(res)!;

    expect((await refresh(otherDevice)).statusCode).toBe(401);
    expect((await refresh(thisDevice)).statusCode).toBe(401);
    expect((await refresh(fresh)).statusCode).toBe(200);

    expect((await login(email, PASSWORD)).statusCode).toBe(401);
    expect((await login(email, 'new-password-1')).statusCode).toBe(200);
  });
});
