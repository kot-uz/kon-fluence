import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(() => env.close());

type Headers = { authorization: string };
let counter = 0;
const signUp = async () => {
  const res = await env.app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: `att${++counter}@example.com`, password: 'correct-horse', fullName: 'Автор' },
  });
  return { authorization: `Bearer ${res.json().accessToken}` } as Headers;
};

const createPage = async (headers: Headers) => {
  const space = (await env.app.inject({ method: 'POST', url: '/docs/Spaces', headers, payload: { title: 'S' } })).json();
  const page = (
    await env.app.inject({
      method: 'POST',
      url: '/docs/Pages',
      headers,
      payload: { spaceType: 'space', spaceId: space.id, title: 'P' },
    })
  ).json();
  return { space, page };
};

const BOUNDARY = 'xBOUNDARYx';
const multipartBody = (fields: Record<string, string>, file?: { name: string; type: string; data: Buffer }) => {
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`
      ),
      file.data,
      Buffer.from('\r\n')
    );
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(parts);
};

const upload = (headers: Headers, body: Buffer) =>
  env.app.inject({
    method: 'POST',
    url: '/docs/Attachments',
    headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    payload: body,
  });

const DATA = Buffer.from('0123456789abcdef');
const uploadFile = async (headers: Headers, pageId: string, name = 'файл.txt', type = 'text/plain') => {
  const res = await upload(headers, multipartBody({ pageId }, { name, type, data: DATA }));
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string; size: number; fileName: string; mimeType: string };
};

const download = (headers: Headers, id: string, range?: string) =>
  env.app.inject({
    method: 'GET',
    url: `/docs/Attachments/${id}/Content`,
    headers: { ...headers, ...(range && { range }) },
  });

describe('загрузка вложений', () => {
  it('сохраняет файл в хранилище и запись в БД', async () => {
    const owner = await signUp();
    const { page } = await createPage(owner);
    const att = await uploadFile(owner, page.id);
    expect(att).toMatchObject({ fileName: 'файл.txt', mimeType: 'text/plain', size: DATA.length });
    expect(env.storage.objects.size).toBeGreaterThan(0);
  });

  it('требует файл, pageId до файла и права редактора', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const { page } = await createPage(owner);
    const file = { name: 'a.txt', type: 'text/plain', data: DATA };

    expect((await upload(owner, multipartBody({ pageId: page.id }))).statusCode).toBe(400);
    expect((await upload(owner, multipartBody({}, file))).statusCode).toBe(400);
    expect((await upload(stranger, multipartBody({ pageId: page.id }, file))).statusCode).toBe(404);
    const noAuth = await env.app.inject({ method: 'POST', url: '/docs/Attachments' });
    expect(noAuth.statusCode).toBe(401);
    const notMultipart = await env.app.inject({
      method: 'POST',
      url: '/docs/Attachments',
      headers: owner,
      payload: { pageId: page.id },
    });
    expect(notMultipart.statusCode).toBe(415);
  });

  it('отклоняет файл больше 100 МБ и не оставляет его в хранилище', async () => {
    const owner = await signUp();
    const { page } = await createPage(owner);
    const before = env.storage.objects.size;
    const big = Buffer.alloc(100 * 1024 * 1024 + 1);
    const res = await upload(owner, multipartBody({ pageId: page.id }, { name: 'big.bin', type: 'application/octet-stream', data: big }));
    expect(res.statusCode).toBe(413);
    expect(env.storage.objects.size).toBe(before);
  }, 60_000);
});

describe('отдача вложений', () => {
  it('отдаёт файл целиком с нужными заголовками', async () => {
    const owner = await signUp();
    const { page } = await createPage(owner);
    const att = await uploadFile(owner, page.id);
    const res = await download(owner, att.id);
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(DATA)).toBe(true);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-length']).toBe(String(DATA.length));
    // text/plain скачивается, имя кодируется в UTF-8
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain(`filename*=UTF-8''${encodeURIComponent('файл.txt')}`);
  });

  it('показывает изображения на месте', async () => {
    const owner = await signUp();
    const { page } = await createPage(owner);
    const att = await uploadFile(owner, page.id, 'a.png', 'image/png');
    expect((await download(owner, att.id)).headers['content-disposition']).toMatch(/^inline/);
    const svg = await uploadFile(owner, page.id, 'a.svg', 'image/svg+xml');
    expect((await download(owner, svg.id)).headers['content-disposition']).toMatch(/^attachment/);
  });

  it('поддерживает Range', async () => {
    const owner = await signUp();
    const { page } = await createPage(owner);
    const att = await uploadFile(owner, page.id);

    const part = await download(owner, att.id, 'bytes=2-5');
    expect(part.statusCode).toBe(206);
    expect(part.rawPayload.toString()).toBe('2345');
    expect(part.headers['content-range']).toBe('bytes 2-5/16');
    expect(part.headers['content-length']).toBe('4');

    expect((await download(owner, att.id, 'bytes=10-')).rawPayload.toString()).toBe('abcdef');
    expect((await download(owner, att.id, 'bytes=-3')).rawPayload.toString()).toBe('def');
    expect((await download(owner, att.id, 'bytes=12-999')).headers['content-range']).toBe('bytes 12-15/16');

    const bad = await download(owner, att.id, 'bytes=100-200');
    expect(bad.statusCode).toBe(416);
    expect(bad.headers['content-range']).toBe('bytes */16');
    // нераспознанный заголовок игнорируется
    expect((await download(owner, att.id, 'items=1-2')).statusCode).toBe(200);
  });

  it('проверяет доступ к пространству', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const { page } = await createPage(owner);
    const att = await uploadFile(owner, page.id);
    expect((await download(stranger, att.id)).statusCode).toBe(404);
    expect((await download(owner, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
    expect((await env.app.inject({ method: 'GET', url: `/docs/Attachments/${att.id}/Content` })).statusCode).toBe(401);
  });

  it('удаляет файлы из хранилища вместе со страницей', async () => {
    const owner = await signUp();
    const { page } = await createPage(owner);
    const att = await uploadFile(owner, page.id);
    const before = env.storage.objects.size;
    const res = await env.app.inject({ method: 'DELETE', url: `/docs/Pages/${page.id}`, headers: owner });
    expect(res.statusCode).toBe(200);
    expect(env.storage.objects.size).toBe(before - 1);
    expect((await download(owner, att.id)).statusCode).toBe(404);
  });
});

describe('подписанные ссылки', () => {
  const signedUrl = (headers: Headers, id: string) =>
    env.app.inject({ method: 'POST', url: `/docs/Attachments/${id}/SignedUrl`, headers });

  it('отдаёт содержимое и Range по ссылке без заголовка Authorization', async () => {
    const owner = await signUp();
    const { page } = await createPage(owner);
    const att = await uploadFile(owner, page.id, 'clip.mp4', 'video/mp4');

    const res = await signedUrl(owner, att.id);
    expect(res.statusCode).toBe(200);
    const { url } = res.json();
    expect(url).toContain(`/docs/Attachments/${att.id}/Content?token=`);

    const full = await env.app.inject({ method: 'GET', url });
    expect(full.statusCode).toBe(200);
    expect(full.rawPayload.equals(DATA)).toBe(true);
    const part = await env.app.inject({ method: 'GET', url, headers: { range: 'bytes=2-5' } });
    expect(part.statusCode).toBe(206);
    expect(part.body).toBe('2345');
  });

  it('не выдаёт ссылку постороннему; токен не подходит к другому вложению и не заменяет access-токен', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const { page } = await createPage(owner);
    const one = await uploadFile(owner, page.id);
    const two = await uploadFile(owner, page.id);

    expect((await signedUrl(stranger, one.id)).statusCode).toBe(404);
    expect((await env.app.inject({ method: 'POST', url: `/docs/Attachments/${one.id}/SignedUrl` })).statusCode).toBe(401);

    const { url } = (await signedUrl(owner, one.id)).json();
    const token = new URL(url, 'http://x').searchParams.get('token')!;
    const other = await env.app.inject({ method: 'GET', url: `/docs/Attachments/${two.id}/Content?token=${token}` });
    expect(other.statusCode).toBe(401);
    const forged = await env.app.inject({ method: 'GET', url: `/docs/Attachments/${one.id}/Content?token=garbage` });
    expect(forged.statusCode).toBe(401);
    const asAccess = await env.app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${token}` } });
    expect(asAccess.statusCode).toBe(401);
  });

  it('без токена и без авторизации содержимое недоступно', async () => {
    const owner = await signUp();
    const { page } = await createPage(owner);
    const att = await uploadFile(owner, page.id);
    expect((await env.app.inject({ method: 'GET', url: `/docs/Attachments/${att.id}/Content` })).statusCode).toBe(401);
  });
});
