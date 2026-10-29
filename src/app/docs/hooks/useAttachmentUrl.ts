import { useEffect, useState } from 'react';
import { getAttachmentBlob } from '../api/attachmentsTransport';

/** Запись кэша: один objectURL на вложение для всех блоков страницы. */
interface CacheEntry {
  refs: number;
  url: string | null;
  releaseTimer: ReturnType<typeof setTimeout> | undefined;
  promise: Promise<string>;
}

// fileId → { promise, url, refs, releaseTimer }
const cache = new Map<string, CacheEntry>();

// URL освобождается не сразу: при переключении просмотр ↔ редактирование блоки
// пересоздаются и иначе скачивали бы файл заново.
const RELEASE_DELAY = 30 * 1000;

const acquire = (fileId: string) => {
  let entry = cache.get(fileId);
  if (!entry) {
    // колбэки срабатывают после присваивания created, поэтому ссылаются на него напрямую
    const promise = getAttachmentBlob(fileId).then((blob) => {
      const url = URL.createObjectURL(blob);
      created.url = url;
      return url;
    });
    // при ошибке не кэшируем — следующий блок попробует снова
    promise.catch(() => {
      if (cache.get(fileId) === created) cache.delete(fileId);
    });
    const created: CacheEntry = { refs: 0, url: null, releaseTimer: undefined, promise };
    cache.set(fileId, created);
    entry = created;
  }
  clearTimeout(entry.releaseTimer);
  entry.refs += 1;
  return entry;
};

const release = (fileId: string, entry: CacheEntry) => {
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.releaseTimer = setTimeout(() => {
    if (entry.refs > 0 || cache.get(fileId) !== entry) return;
    cache.delete(fileId);
    if (entry.url) URL.revokeObjectURL(entry.url);
  }, RELEASE_DELAY);
};

/** objectURL вложения: { url, isLoading, isError }. */
export const useAttachmentUrl = (fileId: string | null | undefined) => {
  const [state, setState] = useState<{ url: string | null; isError: boolean }>(() => ({
    url: (fileId && cache.get(fileId)?.url) || null,
    isError: false,
  }));

  useEffect(() => {
    if (!fileId) return undefined;
    let active = true;
    const entry = acquire(fileId);
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
      release(fileId, entry);
    };
  }, [fileId]);

  return { ...state, isLoading: !!fileId && !state.url && !state.isError };
};
