import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupOrphanAttachments, ORPHAN_GRACE_MS } from '../src/docs/attachment-cleanup';
import { attachments, pages } from '../src/db/schema';
import { createTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(() => env.close());

const insertAttachment = async (pageId: string | null, userId: string) => {
  const storageKey = `k-${Math.random()}`;
  await env.storage.put(storageKey, (await import('node:stream')).Readable.from([Buffer.from('x')]), 'text/plain');
  const [row] = await env.db
    .insert(attachments)
    .values({ pageId, fileName: 'f.txt', mimeType: 'text/plain', size: 1, storageKey, uploadedById: userId })
    .returning();
  return row;
};

describe('очистка осиротевших вложений', () => {
  it('удаляет неупомянутые в содержимом файлы старше срока и оставляет остальные', async () => {
    const reg = await env.app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'cleanup@example.com', password: 'correct-horse', fullName: 'Автор' },
    });
    const headers = { authorization: `Bearer ${reg.json().accessToken}` };
    const userId = reg.json().user.id as string;
    const space = (await env.app.inject({ method: 'POST', url: '/docs/Spaces', headers, payload: { title: 'S' } })).json();
    const page = (
      await env.app.inject({ method: 'POST', url: '/docs/Pages', headers, payload: { spaceType: 'space', spaceId: space.id, title: 'P' } })
    ).json();

    const used = await insertAttachment(page.id, userId);
    const unused = await insertAttachment(page.id, userId);
    const detached = await insertAttachment(null, userId);
    await env.db
      .update(pages)
      .set({ content: { type: 'doc', content: [{ type: 'file', attrs: { fileId: used.id } }] } })
      .where(eq(pages.id, page.id));

    // свежие файлы не трогаем, даже если на них никто не ссылается
    expect(await cleanupOrphanAttachments(env.db, env.storage)).toBe(0);

    const later = new Date(Date.now() + ORPHAN_GRACE_MS + 60_000);
    expect(await cleanupOrphanAttachments(env.db, env.storage, later)).toBe(2);

    const left = (await env.db.select({ id: attachments.id }).from(attachments)).map((row) => row.id);
    expect(left).toContain(used.id);
    expect(left).not.toContain(unused.id);
    expect(left).not.toContain(detached.id);
    expect(env.storage.objects.has(used.storageKey)).toBe(true);
    expect(env.storage.objects.has(unused.storageKey)).toBe(false);
    expect(env.storage.objects.has(detached.storageKey)).toBe(false);
  });
});
