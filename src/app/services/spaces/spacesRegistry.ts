import { useSyncExternalStore } from 'react';
import { nanoid } from 'nanoid';

/**
 * Реестр пространств документации.
 *
 * Пространства живут локально: список в
 * localStorage, страницы — в IndexedDB (моки модуля) или в бекенде по тому же spaceId.
 */
const STORAGE_KEY = 'docs-spaces';

/** Пространство документации в локальном реестре. */
export interface Space {
  id: string;
  title: string;
  createdAt: string | null;
}

const DEFAULT_SPACES: Space[] = [{ id: 'default', title: 'Моя документация', createdAt: null }];

const read = (): Space[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SPACES;
    return (parsed as Space[]).filter((space) => space && typeof space.id === 'string');
  } catch {
    return DEFAULT_SPACES;
  }
};

let spaces = read();
const listeners = new Set<() => void>();

const write = (next: Space[]) => {
  spaces = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces));
  } catch {
    // приватный режим браузера: список останется только в памяти вкладки
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => spaces;

export const getSpaces = getSnapshot;

export const getSpace = (id: string) => spaces.find((space) => space.id === id) || null;

export const createSpace = (title: string): Space => {
  const space = { id: nanoid(), title: title.trim(), createdAt: new Date().toISOString() };
  write([...spaces, space]);
  return space;
};

export const renameSpace = (id: string, title: string) =>
  write(spaces.map((space) => (space.id === id ? { ...space, title: title.trim() } : space)));

/**
 * Убирает пространство из списка. Страницы в IndexedDB остаются: id пространств
 * уникальны (nanoid), так что они больше нигде не всплывут. Полная очистка — resetDocsMockData().
 */
export const deleteSpace = (id: string) => write(spaces.filter((space) => space.id !== id));

/** Живой список пространств: перерисовывает компонент при любом изменении реестра. */
export const useSpaces = () => useSyncExternalStore(subscribe, getSnapshot);

/** Пространство по id или null, если его нет в реестре. */
export const useSpace = (id: string | undefined) => {
  const list = useSpaces();
  return list.find((space) => space.id === id) || null;
};
