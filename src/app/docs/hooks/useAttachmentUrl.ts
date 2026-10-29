import { useEffect, useState } from 'react';
import { getAttachmentBlob, getAttachmentMediaUrl } from '../api/attachmentsTransport';

/** Запись кэша: один objectURL на вложение для всех блоков страницы. */
interface CacheEntry {
  refs: number;
  url: string | null;
  /** Подписанные ссылки живут ограниченное время; null — бессрочно. */
  expiresAt: number | null;
  releaseTimer: ReturnType<typeof setTimeout> | undefined;
  promise: Promise<string>;
}

// ключ (fileId + способ загрузки) → { promise, url, refs, releaseTimer }
const cache = new Map<string, CacheEntry>();

// URL освобождается не сразу: при переключении просмотр ↔ редактирование блоки
// пересоздаются и иначе скачивали бы файл заново.
const RELEASE_DELAY = 30 * 1000;

// запас до истечения подписанной ссылки, при котором её уже не переиспользуем
const EXPIRY_MARGIN = 60 * 1000;

const cacheKey = (fileId: string, streaming: boolean) => `${streaming ? 'media' : 'blob'}:${fileId}`;

const load = async (fileId: string, streaming: boolean) => {
  if (streaming) return getAttachmentMediaUrl(fileId);
  return { url: URL.createObjectURL(await getAttachmentBlob(fileId)), expiresAt: null };
};

const acquire = (fileId: string, streaming: boolean) => {
  const key = cacheKey(fileId, streaming);
  let entry = cache.get(key);
  if (entry?.expiresAt && entry.expiresAt - EXPIRY_MARGIN < Date.now()) {
    cache.delete(key);
    entry = undefined;
  }
  if (!entry) {
    // колбэки срабатывают после присваивания created, поэтому ссылаются на него напрямую
    const promise = load(fileId, streaming).then((media) => {
      created.url = media.url;
      created.expiresAt = media.expiresAt;
      return media.url;
    });
    // при ошибке не кэшируем — следующий блок попробует снова
    promise.catch(() => {
      if (cache.get(key) === created) cache.delete(key);
    });
    const created: CacheEntry = { refs: 0, url: null, expiresAt: null, releaseTimer: undefined, promise };
    cache.set(key, created);
    entry = created;
  }
  clearTimeout(entry.releaseTimer);
  entry.refs += 1;
  return entry;
};

const release = (key: string, entry: CacheEntry) => {
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.releaseTimer = setTimeout(() => {
    if (entry.refs > 0 || cache.get(key) !== entry) return;
    cache.delete(key);
    if (entry.url) URL.revokeObjectURL(entry.url);
  }, RELEASE_DELAY);
};

/**
 * URL вложения: { url, isLoading, isError }. По умолчанию objectURL (для <img>);
 * `streaming` отдаёт ссылку для <video>/<audio>: в облаке подписанную, с Range и без загрузки целиком.
 */
export const useAttachmentUrl = (fileId: string | null | undefined, streaming = false) => {
  const [state, setState] = useState<{ url: string | null; isError: boolean }>(() => ({
    url: (fileId && cache.get(cacheKey(fileId, streaming))?.url) || null,
    isError: false,
  }));

  useEffect(() => {
    if (!fileId) return undefined;
    let active = true;
    const key = cacheKey(fileId, streaming);
    const entry = acquire(fileId, streaming);
    if (entry.url) setState({ url: entry.url, isError: false });
    else {
      setState({ url: null, isError: false });
      entry.promise.then(
        (url) => active && setState({ url, isError: false }),
        () => active && setState({ url: null, isError: true })
      );
    }
    return () => {
      active = false;
      release(key, entry);
    };
  }, [fileId, streaming]);

  return { ...state, isLoading: !!fileId && !state.url && !state.isError };
};
