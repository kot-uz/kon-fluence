import { Readable } from 'node:stream';
import type { Storage } from './storage';

/** Хранилище в памяти для тестов. */
export const createMemoryStorage = (): Storage & { objects: Map<string, Buffer> } => {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    async put(key, body) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(chunk as Buffer);
      const data = Buffer.concat(chunks);
      objects.set(key, data);
      return data.length;
    },
    async get(key, range) {
      const data = objects.get(key);
      if (!data) throw new Error('NoSuchKey');
      const part = range ? data.subarray(range.start, range.end + 1) : data;
      return { body: Readable.from([part]), contentLength: part.length };
    },
    async delete(keys) {
      for (const key of keys) objects.delete(key);
    },
  };
};
