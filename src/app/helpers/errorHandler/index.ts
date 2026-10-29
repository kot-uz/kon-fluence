import i18next from 'i18next';
import { showMessage } from 'app/store/layout/messageSlice';
import store from 'app/store';

/** Всё, из чего обработчик умеет достать текст: ошибка RTK Query, axios или обычный Error. */
export interface AppError {
  status?: number | string;
  message?: string;
  data?: unknown;
  response?: { data?: unknown };
}

/** Тело ответа с сообщением — вложенность повторяет ответы бекенда и моков. */
interface ErrorBody {
  message?: unknown;
  data?: unknown;
}

const asBody = (value: unknown): ErrorBody | null =>
  value && typeof value === 'object' ? (value as ErrorBody) : null;

/**
 * Разбор ошибки и показ сообщения: разбирает ответы RTK Query и axios.
 */
const toMessage = (error: AppError | null | undefined) => {
  const fallback = i18next.t('Error', { ns: 'translations' });
  if (!error) return fallback;

  // ошибка RTK Query: { status, data: { message } }
  const data = error.response?.data ?? error.data;

  if (typeof data === 'string' && data.trim()) return data;

  const body = asBody(data);
  const nested = asBody(body?.data);

  if (typeof body?.message === 'string' && body.message.trim()) return body.message;
  if (typeof nested?.message === 'string') return nested.message;
  if (typeof body?.data === 'string' && body.data.trim()) return body.data;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  if (error.status) return `${fallback} (${error.status})`;

  return fallback;
};

const handleError = (error: unknown) => {
  const message = toMessage(error as AppError);
  console.error('[docs]', error);
  store.dispatch(showMessage({ message, variant: 'error' }));
  return message;
};

export default handleError;
