import { useCallback, useEffect, useRef, useState } from 'react';
import { readStorage, removeStorage, writeStorage } from '../utils/storage';
import type { PageDraft } from '../types';

const DRAFT_DELAY = 1000;

const getDraftKey = (pageId: string) => `docs-draft:${pageId}`;

const pendingFlushes = new Set<() => void>();

/** Сразу пишет все отложенные черновики (например, перед переносом данных в аккаунт). */
export const flushPendingDrafts = () => pendingFlushes.forEach((flush) => flush());

/** Черновик без времени сохранения — его ставит сам хук. */
type DraftInput = Omit<PageDraft, 'savedAt'>;

/**
 * Локальный черновик страницы в режиме редактирования: { title, content, baseVersion, savedAt }.
 * saveDraft пишет с задержкой, flushDraft — сразу (перед уходом/конфликтом).
 */
export const useDraft = (pageId: string) => {
  const key = getDraftKey(pageId);
  const [initialDraft] = useState(() => readStorage<PageDraft | null>(key, null));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef<DraftInput | null>(null);

  const flushDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    if (!pendingRef.current) return;
    const draft: PageDraft = { ...pendingRef.current, savedAt: new Date().toISOString() };
    pendingRef.current = null;
    writeStorage(key, draft);
    setSavedAt(draft.savedAt);
  }, [key]);

  const saveDraft = useCallback(
    (draft: DraftInput) => {
      pendingRef.current = draft;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushDraft, DRAFT_DELAY);
    },
    [flushDraft]
  );

  const clearDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    pendingRef.current = null;
    removeStorage(key);
    setSavedAt(null);
  }, [key]);

  useEffect(() => {
    pendingFlushes.add(flushDraft);
    return () => {
      pendingFlushes.delete(flushDraft);
    };
  }, [flushDraft]);

  // при уходе со страницы несохранённый хвост не теряем
  useEffect(() => flushDraft, [flushDraft]);

  return { initialDraft, savedAt, saveDraft, flushDraft, clearDraft };
};
