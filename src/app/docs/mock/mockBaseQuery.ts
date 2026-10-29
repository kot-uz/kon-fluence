import type { RootState } from 'app/store';
import type { DocsBaseQuery, RtkQueryArgs } from 'app/helpers/rtkquery';
import { MockHttpError, routes } from './handlers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Заменяет сетевой baseQuery, пока нет бекенда. Данные хранятся в IndexedDB браузера.
export const mockBaseQuery: DocsBaseQuery = async (args, api) => {
  const { url, method = 'GET', body }: RtkQueryArgs =
    typeof args === 'string' ? { url: args } : args;
  const route = routes.find(
    ([routeMethod, pattern]) => routeMethod === method.toUpperCase() && pattern.test(url)
  );

  await sleep(150 + Math.random() * 150);

  if (!route) {
    return { error: { status: 404, data: { message: `Mock route not found: ${method} ${url}` } } };
  }

  const [, pattern, handler] = route;
  const params = url.match(pattern)!.slice(1).map(decodeURIComponent);
  const { user } = api.getState() as RootState;

  try {
    // тело запроса проверяет сам обработчик — он один знает свою форму
    const data = await handler({ params, body: body as never, user });
    return { data };
  } catch (error) {
    if (error instanceof MockHttpError) {
      return {
        error: { status: error.status, data: { message: error.message, data: error.data } },
      };
    }
    console.error('[docs mock]', error);
    return { error: { status: 500, data: { message: (error as Error).message } } };
  }
};
