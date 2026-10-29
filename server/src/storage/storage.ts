import type { Readable } from 'node:stream';

export interface StoredObject {
  body: Readable;
  /** Длина отдаваемой части (для Range — длина диапазона). */
  contentLength: number;
}

/** Файловое хранилище вложений (S3 в рантайме, in-memory в тестах). */
export interface Storage {
  /** Записывает поток; возвращает число записанных байт. При ошибке потока ничего не остаётся. */
  put(key: string, body: Readable, contentType: string): Promise<number>;
  /** Читает объект целиком или байты `start..end` (включительно). */
  get(key: string, range?: { start: number; end: number }): Promise<StoredObject>;
  delete(keys: string[]): Promise<void>;
}
