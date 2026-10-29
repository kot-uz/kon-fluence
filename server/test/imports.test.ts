import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { cleanupExpiredImports } from '../src/docs/import-cleanup';
import { attachments, imports } from '../src/db/schema';
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
    payload: { email: `imp${++counter}@example.com`, password: 'correct-horse', fullName: 'Автор' },
  });
  return { authorization: `Bearer ${res.json().accessToken}` } as Headers;
};

const BOUNDARY = 'xBOUNDARYx';
const multipartBody = (fields: Record<string, string>, file?: { name: string; type: string; data: Buffer }) => {
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (file) {
    parts.push(
      Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`),
      file.data,
      Buffer.from('\r\n')
    );
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(parts);
};

const startImport = async (headers: Headers) =>
  (await env.app.inject({ method: 'POST', url: '/docs/Imports', headers })).json().importId as string;

const uploadFile = (headers: Headers, importId: string, localId: string, data = Buffer.from('hello')) =>
  env.app.inject({
    method: 'POST',
    url: `/docs/Imports/${importId}/Attachments`,
    headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    payload: multipartBody({ localId }, { name: 'a.txt', type: 'text/plain', data }),
  });

const commit = (headers: Headers, importId: string, payload: unknown) =>
  env.app.inject({ method: 'POST', url: `/docs/Imports/${importId}/Commit`, headers, payload: payload as object });

const doc = (...content: object[]) => ({ type: 'doc', content });
const image = (fileId: string) => ({ type: 'imageBlock', attrs: { fileId, fileName: 'a.png' } });

const basePayload = () => ({
  spaces: [{ localId: 's1', title: 'Локальное' }],
  pages: [
    {
      localId: 'p1',
      spaceLocalId: 's1',
      title: 'Корень',
      content: doc(image('f1')),
      createdAt: '2024-01-02T03:04:05.000Z',
      updatedAt: '2024-02-03T04:05:06.000Z',
      createdByName: 'Иван',
      updatedByName: 'Пётр',
    },
    {
      localId: 'p2',
      spaceLocalId: 's1',
      parentLocalId: 'p1',
      title: 'Дочерняя',
      content: doc({
        type: 'paragraph',
        content: [{ type: 'text', text: 'ссылка', marks: [{ type: 'link', attrs: { href: '/docs/page/p1' } }] }],
      }),
    },
  ],
});

describe('импорт', () => {
  it('создаёт сессию только для авторизованного', async () => {
    expect((await env.app.inject({ method: 'POST', url: '/docs/Imports' })).statusCode).toBe(401);
    const headers = await signUp();
    const res = await env.app.inject({ method: 'POST', url: '/docs/Imports', headers });
    expect(res.statusCode).toBe(201);
    expect(res.json().importId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('commit: новые id, fileId и ссылки переписаны, даты и авторы сохранены', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const file = await uploadFile(headers, importId, 'f1');
    expect(file.statusCode).toBe(201);

    const res = await commit(headers, importId, basePayload());
    expect(res.statusCode).toBe(200);
    const result = res.json();
    const pageId = result.pages.p1;
    expect(pageId).not.toBe('p1');
    expect(result.attachments.f1).toBe(file.json().id);

    const page = (await env.app.inject({ method: 'GET', url: `/docs/Pages/${pageId}`, headers })).json();
    expect(page.content.content[0].attrs.fileId).toBe(file.json().id);
    expect(page.createdAt).toBe('2024-01-02T03:04:05.000Z');
    expect(page.updatedAt).toBe('2024-02-03T04:05:06.000Z');
    expect(page.createdBy.fullName).toBe('Иван');
    expect(page.updatedBy.fullName).toBe('Пётр');

    const child = (await env.app.inject({ method: 'GET', url: `/docs/Pages/${result.pages.p2}`, headers })).json();
    expect(child.parentId).toBe(pageId);
    expect(child.content.content[0].content[0].marks[0].attrs.href).toBe(`/docs/page/${pageId}`);

    const content = await env.app.inject({ method: 'GET', url: `/docs/Attachments/${file.json().id}/Content`, headers });
    expect(content.statusCode).toBe(200);
    expect(content.body).toBe('hello');

    const spaces = (await env.app.inject({ method: 'GET', url: '/docs/Spaces', headers })).json();
    expect(spaces.map((s: { id: string }) => s.id)).toContain(result.spaces.s1);
  });

  it('повторный commit возвращает тот же результат без дублей', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    await uploadFile(headers, importId, 'f1');
    const first = await commit(headers, importId, basePayload());
    const second = await commit(headers, importId, basePayload());
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    const spaces = (await env.app.inject({ method: 'GET', url: '/docs/Spaces', headers })).json();
    expect(spaces).toHaveLength(1);
  });

  it('повторная загрузка с тем же localId не дублирует файл', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const first = await uploadFile(headers, importId, 'f1');
    const keys = env.storage.objects.size;
    const again = await uploadFile(headers, importId, 'f1', Buffer.from('другое'));
    expect(again.statusCode).toBe(200);
    expect(again.json().id).toBe(first.json().id);
    expect(env.storage.objects.size).toBe(keys);
  });

  it('обрыв загрузки не оставляет файла, повтор проходит', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const before = env.storage.objects.size;
    const broken = await env.app.inject({
      method: 'POST',
      url: `/docs/Imports/${importId}/Attachments`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      // Тело оборвано: закрывающей границы нет.
      payload: Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="localId"\r\n\r\nf1\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nпол`
      ),
    });
    expect(broken.statusCode).toBeGreaterThanOrEqual(400);
    expect(env.storage.objects.size).toBe(before);
    expect(await env.app.inject({ method: 'GET', url: '/docs/Spaces', headers })).toBeTruthy();
    expect((await uploadFile(headers, importId, 'f1')).statusCode).toBe(201);
  });

  it('битый родитель, чужое пространство и цикл → 400, ничего не создаётся', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const page = (localId: string, parentLocalId: string | null, spaceLocalId = 's1') => ({
      localId,
      spaceLocalId,
      parentLocalId,
      title: localId,
      content: doc(),
    });
    const spaces = [
      { localId: 's1', title: 'A' },
      { localId: 's2', title: 'B' },
    ];

    const missing = await commit(headers, importId, { spaces, pages: [page('a', 'нет')] });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().code).toBe('PARENT_NOT_FOUND');

    const crossSpace = await commit(headers, importId, { spaces, pages: [page('a', null, 's2'), page('b', 'a', 's1')] });
    expect(crossSpace.json().code).toBe('PARENT_NOT_FOUND');

    const cycle = await commit(headers, importId, { spaces, pages: [page('a', 'b'), page('b', 'a')] });
    expect(cycle.json().code).toBe('PARENT_CYCLE');

    const self = await commit(headers, importId, { spaces, pages: [page('a', 'a')] });
    expect(self.json().code).toBe('PARENT_CYCLE');

    const noSpace = await commit(headers, importId, { spaces, pages: [page('a', null, 'x')] });
    expect(noSpace.json().code).toBe('SPACE_NOT_FOUND');

    const dup = await commit(headers, importId, { spaces, pages: [page('a', null), page('a', null)] });
    expect(dup.json().code).toBe('DUPLICATE_ID');

    expect((await env.app.inject({ method: 'GET', url: '/docs/Spaces', headers })).json()).toHaveLength(0);
    // Сессия после ошибок остаётся открытой.
    expect((await commit(headers, importId, { spaces, pages: [page('a', null), page('b', 'a')] })).statusCode).toBe(200);
  });

  it('страницы в произвольном порядке: потомок раньше родителя', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const res = await commit(headers, importId, {
      spaces: [{ localId: 's', title: 'S' }],
      pages: [
        { localId: 'child', spaceLocalId: 's', parentLocalId: 'root', title: 'c', content: doc() },
        { localId: 'root', spaceLocalId: 's', title: 'r', content: doc() },
      ],
    });
    expect(res.statusCode).toBe(200);
  });

  it('fileId из другой сессии или чужой → 400', async () => {
    const owner = await signUp();
    const other = await signUp();
    const foreignImport = await startImport(other);
    await uploadFile(other, foreignImport, 'f1');

    const importId = await startImport(owner);
    const res = await commit(owner, importId, basePayload());
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('FILE_NOT_FOUND');
  });

  it('чужая сессия недоступна: 404', async () => {
    const owner = await signUp();
    const other = await signUp();
    const importId = await startImport(owner);
    expect((await uploadFile(other, importId, 'f1')).statusCode).toBe(404);
    expect((await commit(other, importId, { spaces: [], pages: [] })).statusCode).toBe(404);
  });

  it('загрузка в завершённую сессию → 409, неиспользованные файлы удаляются', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const unused = await uploadFile(headers, importId, 'unused');
    const key = env.storage.objects.size;
    expect((await commit(headers, importId, { spaces: [], pages: [] })).statusCode).toBe(200);
    expect(env.storage.objects.size).toBe(key - 1);
    expect((await env.db.select().from(attachments).where(eq(attachments.id, unused.json().id)))).toHaveLength(0);
    expect((await uploadFile(headers, importId, 'f2')).statusCode).toBe(409);
  });

  it('лимиты: схема страницы, название и валидатор content', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const spaces = [{ localId: 's', title: 'S' }];
    const page = (extra: object) => ({ localId: 'p', spaceLocalId: 's', title: 't', content: doc(), ...extra });

    expect((await commit(headers, importId, { spaces, pages: [page({ title: 'x'.repeat(256) })] })).statusCode).toBe(400);
    expect((await commit(headers, importId, { spaces, pages: [page({ content: { type: 'text' } })] })).statusCode).toBe(400);
    expect((await commit(headers, importId, { spaces, pages: [page({ createdAt: 'вчера' })] })).statusCode).toBe(400);
    expect((await commit(headers, importId, { spaces: [{ localId: 's', title: '' }], pages: [] })).statusCode).toBe(400);
    expect((await commit(headers, 'не-uuid', { spaces, pages: [] })).statusCode).toBe(400);
  });

  it('просроченная сессия: 410 и очистка файлов', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const file = await uploadFile(headers, importId, 'f1');
    await env.db.update(imports).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(imports.id, importId));

    expect((await commit(headers, importId, { spaces: [], pages: [] })).statusCode).toBe(410);
    expect((await uploadFile(headers, importId, 'f2')).statusCode).toBe(410);

    const objects = env.storage.objects.size;
    expect(await cleanupExpiredImports(env.db, env.storage)).toBeGreaterThanOrEqual(1);
    expect(env.storage.objects.size).toBe(objects - 1);
    expect(await env.db.select().from(imports).where(eq(imports.id, importId))).toHaveLength(0);
    expect(await env.db.select().from(attachments).where(eq(attachments.id, file.json().id))).toHaveLength(0);
  });

  it('очистка не трогает вложения завершённого импорта и активные сессии', async () => {
    const headers = await signUp();
    const done = await startImport(headers);
    const file = await uploadFile(headers, done, 'f1');
    await commit(headers, done, basePayload());
    const active = await startImport(headers);
    await env.db.update(imports).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(imports.id, done));

    await cleanupExpiredImports(env.db, env.storage);
    expect(await env.db.select().from(attachments).where(eq(attachments.id, file.json().id))).toHaveLength(1);
    expect(await env.db.select().from(imports).where(eq(imports.id, active))).toHaveLength(1);
  });

  it('файл больше 100 МБ → 413, ничего не остаётся', async () => {
    const headers = await signUp();
    const importId = await startImport(headers);
    const before = env.storage.objects.size;
    const res = await uploadFile(headers, importId, 'big', Buffer.alloc(100 * 1024 * 1024 + 1));
    expect(res.statusCode).toBe(413);
    expect(env.storage.objects.size).toBe(before);
  });
});
