import { nanoid } from 'nanoid';
import type { Attachment } from '../types';
import { getDb } from './db';
import type { StoredAttachment } from './db';
import { LocalHttpError } from './handlers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PROGRESS_STEPS = 10;
// имитация скорости сети, чтобы был виден прогресс загрузки
const BYTES_PER_MS = 20 * 1024;

/** Аргументы загрузки вложения (та же форма у мока и у реального запроса). */
export interface UploadAttachmentArgs {
  file: File;
  pageId: string;
  onProgress?: (percent: number) => void;
}

const toAttachment = ({ blob: _blob, ...attachment }: StoredAttachment): Attachment => attachment;

// Аналог POST /Attachments: файл хранится в IndexedDB как Blob.
export const localUploadAttachment = async ({
  file,
  pageId,
  onProgress,
}: UploadAttachmentArgs): Promise<Attachment> => {
  const db = await getDb();
  if (!(await db.get('pages', pageId))) throw new LocalHttpError(404, 'Page not found');

  const duration = Math.min(4000, Math.max(500, file.size / BYTES_PER_MS));
  for (let step = 1; step <= PROGRESS_STEPS; step += 1) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(duration / PROGRESS_STEPS);
    onProgress?.(Math.round((step / PROGRESS_STEPS) * 100));
  }

  const record: StoredAttachment = {
    id: nanoid(),
    pageId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
  };
  await db.put('attachments', record);
  return toAttachment(record);
};

// Аналог GET /Attachments/{id}/Content
export const localGetAttachmentBlob = async (id: string): Promise<Blob> => {
  const record = await (await getDb()).get('attachments', id);
  if (!record) throw new LocalHttpError(404, 'Attachment not found');
  return record.blob;
};
