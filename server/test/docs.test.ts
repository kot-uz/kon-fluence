import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(() => env.close());

type Headers = { authorization: string };
let counter = 0;
const signUp = async (fullName = 'Автор') => {
  const res = await env.app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: `docs${++counter}@example.com`, password: 'correct-horse', fullName },
  });
  const { accessToken, user } = res.json();
  return { id: user.id as string, headers: { authorization: `Bearer ${accessToken}` } as Headers };
};

const api = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, headers: Headers, payload?: unknown) =>
  env.app.inject({ method, url: `/docs${url}`, headers, payload: payload as object | undefined });

const createSpace = async (headers: Headers, title = 'Пространство') =>
  (await api('POST', '/Spaces', headers, { title })).json() as { id: string; title: string; role: string };

const createPage = async (headers: Headers, spaceId: string, extra: Record<string, unknown> = {}) => {
  const res = await api('POST', '/Pages', headers, { spaceType: 'space', spaceId, title: 'Страница', ...extra });
  expect(res.statusCode).toBe(201);
  return res.json();
};

const getTree = async (headers: Headers, spaceId: string) =>
  (await api('GET', `/Spaces/space/${spaceId}/Tree`, headers)).json() as {
    id: string;
    parentId: string | null;
    position: number;
    title: string;
  }[];

const taskDoc = {
  type: 'doc',
  content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { id: 't1', checked: false } }] }],
};

describe('пространства', () => {
  it('создаёт, переименовывает и мягко удаляет', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers, 'Первое');
    expect(space).toMatchObject({ title: 'Первое', role: 'owner' });

    const list = (await api('GET', '/Spaces', owner.headers)).json();
    expect(list.map((s: { id: string }) => s.id)).toContain(space.id);

    const renamed = await api('PATCH', `/Spaces/${space.id}`, owner.headers, { title: '  Новое  ' });
    expect(renamed.json().title).toBe('Новое');

    expect((await api('DELETE', `/Spaces/${space.id}`, owner.headers)).statusCode).toBe(204);
    expect((await api('GET', '/Spaces', owner.headers)).json()).toEqual([]);
    expect((await api('GET', `/Spaces/space/${space.id}/Tree`, owner.headers)).statusCode).toBe(404);
  });

  it('пустое название — 400', async () => {
    const owner = await signUp();
    const res = await api('POST', '/Spaces', owner.headers, { title: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('чужое пространство — 404, список только своих', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const space = await createSpace(owner.headers);
    expect((await api('PATCH', `/Spaces/${space.id}`, stranger.headers, { title: 'x' })).statusCode).toBe(404);
    expect((await api('DELETE', `/Spaces/${space.id}`, stranger.headers)).statusCode).toBe(404);
    expect((await api('GET', `/Spaces/space/${space.id}/Tree`, stranger.headers)).statusCode).toBe(404);
    expect((await api('GET', '/Spaces', stranger.headers)).json()).toEqual([]);
  });

  it('тип в URL дерева должен совпадать с типом пространства', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    expect((await api('GET', `/Spaces/project/${space.id}/Tree`, owner.headers)).statusCode).toBe(404);
  });

  it('без токена — 401', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/docs/Spaces' });
    expect(res.statusCode).toBe(401);
  });
});

describe('страницы: создание и чтение', () => {
  it('создаёт страницу с автором из токена и позицией «последняя + 1»', async () => {
    const owner = await signUp('Иван Петров');
    const space = await createSpace(owner.headers);

    const first = await createPage(owner.headers, space.id, { title: '  Первая ' });
    const second = await createPage(owner.headers, space.id, { title: 'Вторая' });
    expect(first).toMatchObject({
      title: 'Первая',
      parentId: null,
      position: 1,
      version: 1,
      spaceType: 'space',
      spaceId: space.id,
      content: { type: 'doc', content: [] },
      createdBy: { id: owner.id, fullName: 'Иван Петров' },
      updatedBy: { id: owner.id, fullName: 'Иван Петров' },
    });
    expect(second.position).toBe(2);

    const child = await createPage(owner.headers, space.id, { parentId: first.id });
    expect(child.position).toBe(1);

    const tree = await getTree(owner.headers, space.id);
    expect(tree.map((item) => item.title)).toEqual(['Первая', 'Страница', 'Вторая']);
    expect(tree[0]).not.toHaveProperty('content');

    const fetched = await api('GET', `/Pages/${first.id}`, owner.headers);
    expect(fetched.json()).toEqual(first);
  });

  it('автор не берётся из тела запроса', async () => {
    const owner = await signUp('Настоящий');
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id, { createdBy: { fullName: 'Подмена' } });
    expect(page.createdBy.fullName).toBe('Настоящий');
  });

  it('валидация: заголовок обязателен и не длиннее 255', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const base = { spaceType: 'space', spaceId: space.id };
    expect((await api('POST', '/Pages', owner.headers, base)).statusCode).toBe(400);
    expect((await api('POST', '/Pages', owner.headers, { ...base, title: ' ' })).statusCode).toBe(400);
    expect((await api('POST', '/Pages', owner.headers, { ...base, title: 'я'.repeat(256) })).statusCode).toBe(400);
    expect((await api('POST', '/Pages', owner.headers, { ...base, title: 'я'.repeat(255) })).statusCode).toBe(201);
  });

  it('родитель должен быть из того же пространства', async () => {
    const owner = await signUp();
    const a = await createSpace(owner.headers);
    const b = await createSpace(owner.headers);
    const foreign = await createPage(owner.headers, b.id);
    const res = await api('POST', '/Pages', owner.headers, {
      spaceType: 'space',
      spaceId: a.id,
      title: 'x',
      parentId: foreign.id,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('PARENT_NOT_FOUND');
  });

  it('невалидный content отклоняется', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const base = { spaceType: 'space', spaceId: space.id, title: 'x' };
    expect((await api('POST', '/Pages', owner.headers, { ...base, content: 'text' })).statusCode).toBe(400);
    expect((await api('POST', '/Pages', owner.headers, { ...base, content: { type: 'paragraph' } })).statusCode).toBe(400);
    expect(
      (await api('POST', '/Pages', owner.headers, { ...base, content: { type: 'doc', content: [{ text: 1 }] } })).statusCode
    ).toBe(400);
    expect(
      (await api('POST', '/Pages', owner.headers, { ...base, content: { type: 'doc', content: 'x' } })).statusCode
    ).toBe(400);
  });

  it('слишком большое тело — 413', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const big = { type: 'doc', content: [{ type: 'text', text: 'a'.repeat(6 * 1024 * 1024) }] };
    const res = await api('POST', '/Pages', owner.headers, { spaceType: 'space', spaceId: space.id, title: 'x', content: big });
    expect(res.statusCode).toBe(413);
    expect(res.json().code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('чужие страницы — 404, создание в чужом пространстве — 404', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id);

    expect((await api('GET', `/Pages/${page.id}`, stranger.headers)).statusCode).toBe(404);
    expect((await api('PUT', `/Pages/${page.id}`, stranger.headers, { version: 1, title: 'x' })).statusCode).toBe(404);
    expect((await api('PATCH', `/Pages/${page.id}/Title`, stranger.headers, { title: 'x' })).statusCode).toBe(404);
    expect((await api('PATCH', `/Pages/${page.id}/Move`, stranger.headers, { parentId: null })).statusCode).toBe(404);
    expect((await api('DELETE', `/Pages/${page.id}`, stranger.headers)).statusCode).toBe(404);
    const created = await api('POST', '/Pages', stranger.headers, { spaceType: 'space', spaceId: space.id, title: 'x' });
    expect(created.statusCode).toBe(404);
    expect((await api('GET', '/Pages/00000000-0000-4000-8000-000000000000', owner.headers)).statusCode).toBe(404);
  });
});

describe('страницы: правка', () => {
  it('PUT повышает версию и обновляет автора', async () => {
    const owner = await signUp('Автор');
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id);
    const content = { type: 'doc', content: [{ type: 'paragraph' }] };

    const res = await api('PUT', `/Pages/${page.id}`, owner.headers, { version: 1, title: ' Новая ', content });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: 'Новая', content, version: 2 });
  });

  it('PUT без title сохраняет прежний заголовок', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id, { title: 'Было' });
    const res = await api('PUT', `/Pages/${page.id}`, owner.headers, { version: 1, content: taskDoc });
    expect(res.json()).toMatchObject({ title: 'Было', version: 2 });
  });

  it('устаревшая версия — 409 с актуальной страницей в теле', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id);
    await api('PUT', `/Pages/${page.id}`, owner.headers, { version: 1, title: 'Чужая правка' });

    const res = await api('PUT', `/Pages/${page.id}`, owner.headers, { version: 1, title: 'Моя правка' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'VERSION_CONFLICT', data: { id: page.id, title: 'Чужая правка', version: 2 } });
    expect((await api('GET', `/Pages/${page.id}`, owner.headers)).json().title).toBe('Чужая правка');
  });

  it('параллельные PUT с одной версией: проходит ровно один', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id);
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) => api('PUT', `/Pages/${page.id}`, owner.headers, { version: 1, title: `Правка ${n}` }))
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(3);
  });

  it('переименование не требует version и повышает её не нужно', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id);
    await api('PUT', `/Pages/${page.id}`, owner.headers, { version: 1, title: 'v2' });

    const res = await api('PATCH', `/Pages/${page.id}/Title`, owner.headers, { title: ' Переименована ' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: 'Переименована', version: 2 });
    expect((await api('PATCH', `/Pages/${page.id}/Title`, owner.headers, { title: ' ' })).statusCode).toBe(400);
  });

  it('viewer читает, но не правит', async () => {
    const owner = await signUp();
    const viewer = await signUp();
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id);
    const { spaceMembers } = await import('../src/db/schema');
    await env.db.insert(spaceMembers).values({ spaceId: space.id, userId: viewer.id, role: 'viewer' });

    expect((await api('GET', `/Pages/${page.id}`, viewer.headers)).statusCode).toBe(200);
    expect((await api('PUT', `/Pages/${page.id}`, viewer.headers, { version: 1, title: 'x' })).statusCode).toBe(403);
    expect((await api('DELETE', `/Pages/${page.id}`, viewer.headers)).statusCode).toBe(403);
    expect(
      (await api('POST', '/Pages', viewer.headers, { spaceType: 'space', spaceId: space.id, title: 'x' })).statusCode
    ).toBe(403);
  });
});

describe('страницы: перенос', () => {
  const setup = async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const a = await createPage(owner.headers, space.id, { title: 'A' });
    const b = await createPage(owner.headers, space.id, { title: 'B' });
    const c = await createPage(owner.headers, space.id, { title: 'C' });
    return { owner, space, a, b, c };
  };

  it('переносит под другого родителя в конец и на указанную позицию', async () => {
    const { owner, space, a, b, c } = await setup();
    const toEnd = await api('PATCH', `/Pages/${c.id}/Move`, owner.headers, { parentId: a.id });
    expect(toEnd.json()).toMatchObject({ parentId: a.id, position: 1 });

    const between = await api('PATCH', `/Pages/${b.id}/Move`, owner.headers, { parentId: null, position: 0.5 });
    expect(between.json().position).toBe(0.5);
    const tree = await getTree(owner.headers, space.id);
    expect(tree.filter((i) => i.parentId === null).map((i) => i.title)).toEqual(['B', 'A']);
  });

  it('при совпадении позиции пересчитывает соседей', async () => {
    const { owner, space, a, b, c } = await setup();
    const res = await api('PATCH', `/Pages/${c.id}/Move`, owner.headers, { parentId: null, position: 1 });
    expect(res.json().position).toBe(1);
    const tree = await getTree(owner.headers, space.id);
    expect(tree.map((i) => [i.title, i.position])).toEqual([
      ['C', 1],
      ['A', 2],
      ['B', 3],
    ]);
    expect(tree.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
  });

  it('запрещает цикл: в себя и в потомка', async () => {
    const { owner, a } = await setup();
    const child = await createPage(owner.headers, a.spaceId, { parentId: a.id });
    const grandchild = await createPage(owner.headers, a.spaceId, { parentId: child.id });

    for (const parentId of [a.id, child.id, grandchild.id]) {
      const res = await api('PATCH', `/Pages/${a.id}/Move`, owner.headers, { parentId });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('MOVE_CYCLE');
    }
    // Перенос потомка выше циклом не является.
    expect((await api('PATCH', `/Pages/${grandchild.id}/Move`, owner.headers, { parentId: null })).statusCode).toBe(200);
  });

  it('родитель из другого пространства — 400', async () => {
    const { owner, a } = await setup();
    const other = await createSpace(owner.headers);
    const foreign = await createPage(owner.headers, other.id);
    const res = await api('PATCH', `/Pages/${a.id}/Move`, owner.headers, { parentId: foreign.id });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('PARENT_NOT_FOUND');
  });
});

describe('страницы: задачи', () => {
  it('отмечает задачу, повышает версию и не трогает остальное', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id, { content: taskDoc });

    const res = await api('PATCH', `/Pages/${page.id}/Tasks/t1`, owner.headers, { checked: true });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(2);
    expect(res.json().content.content[0].content[0].attrs).toEqual({ id: 't1', checked: true });

    const back = await api('PATCH', `/Pages/${page.id}/Tasks/t1`, owner.headers, { checked: false });
    expect(back.json()).toMatchObject({ version: 3 });
    expect(back.json().content.content[0].content[0].attrs.checked).toBe(false);
  });

  it('несуществующая задача — 404', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const page = await createPage(owner.headers, space.id, { content: taskDoc });
    const res = await api('PATCH', `/Pages/${page.id}/Tasks/nope`, owner.headers, { checked: true });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('TASK_NOT_FOUND');
    expect((await api('GET', `/Pages/${page.id}`, owner.headers)).json().version).toBe(1);
  });

  it('параллельные отметки разных задач не теряются', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const ids = ['a', 'b', 'c', 'd'];
    const content = {
      type: 'doc',
      content: [{ type: 'taskList', content: ids.map((id) => ({ type: 'taskItem', attrs: { id, checked: false } })) }],
    };
    const page = await createPage(owner.headers, space.id, { content });

    await Promise.all(ids.map((id) => api('PATCH', `/Pages/${page.id}/Tasks/${id}`, owner.headers, { checked: true })));
    const final = (await api('GET', `/Pages/${page.id}`, owner.headers)).json();
    expect(final.version).toBe(5);
    expect(final.content.content[0].content.map((t: { attrs: { checked: boolean } }) => t.attrs.checked)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});

describe('страницы: удаление', () => {
  it('удаляет страницу с потомками и отдаёт deletedIds', async () => {
    const owner = await signUp();
    const space = await createSpace(owner.headers);
    const root = await createPage(owner.headers, space.id, { title: 'Корень' });
    const child = await createPage(owner.headers, space.id, { parentId: root.id });
    const grandchild = await createPage(owner.headers, space.id, { parentId: child.id });
    const sibling = await createPage(owner.headers, space.id, { title: 'Соседняя' });

    const res = await api('DELETE', `/Pages/${root.id}`, owner.headers);
    expect(res.statusCode).toBe(200);
    expect([...res.json().deletedIds].sort()).toEqual([root.id, child.id, grandchild.id].sort());

    expect((await api('GET', `/Pages/${grandchild.id}`, owner.headers)).statusCode).toBe(404);
    expect((await getTree(owner.headers, space.id)).map((i) => i.id)).toEqual([sibling.id]);
  });
});
