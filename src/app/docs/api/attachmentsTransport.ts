import { httpClient } from '../adapters/transport';
import { localGetAttachmentBlob, localUploadAttachment } from '../local/attachments';
import type { UploadAttachmentArgs } from '../local/attachments';
import type { Attachment } from '../types';
import store from 'app/store';
import { selectStorageMode } from 'app/store/storageModeSlice';

const isLocalMode = () => selectStorageMode(store.getState()) === 'local';

// Загрузка и скачивание вложений идут мимо RTK Query: нужны прогресс загрузки и Blob в ответе.

const realUploadAttachment = async ({
  file,
  pageId,
  onProgress,
}: UploadAttachmentArgs): Promise<Attachment> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pageId', pageId);
  const { data } = await httpClient.post<Attachment>('/docs/Attachments', formData, {
    onUploadProgress: (event) => {
      if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
};

// Blob целиком: <img src> не может передать заголовок авторизации.
const realGetAttachmentBlob = async (id: string): Promise<Blob> => {
  const { data } = await httpClient.get<Blob>(`/docs/Attachments/${id}/Content`, {
    responseType: 'blob',
  });
  return data;
};

/** uploadAttachment({ file, pageId, onProgress(percent) }) → Attachment */
export const uploadAttachment = (args: UploadAttachmentArgs) =>
  isLocalMode() ? localUploadAttachment(args) : realUploadAttachment(args);

/** getAttachmentBlob(id) → Blob */
export const getAttachmentBlob = (id: string) =>
  isLocalMode() ? localGetAttachmentBlob(id) : realGetAttachmentBlob(id);

/** Ссылка на вложение для <video>/<audio>: потоковая (Range) и подписанная в облаке, objectURL на устройстве. */
export interface MediaUrl {
  url: string;
  /** Момент, после которого ссылку нужно запросить заново; null — не истекает. */
  expiresAt: number | null;
}

export const getAttachmentMediaUrl = async (id: string): Promise<MediaUrl> => {
  if (isLocalMode()) return { url: URL.createObjectURL(await localGetAttachmentBlob(id)), expiresAt: null };
  const { data } = await httpClient.post<{ url: string; expiresAt: string }>(`/docs/Attachments/${id}/SignedUrl`);
  const base = (httpClient.defaults.baseURL || '').replace(/\/$/, '');
  return { url: `${base}${data.url}`, expiresAt: Date.parse(data.expiresAt) };
};

/** Сохраняет вложение на диск через временную ссылку. */
export const downloadAttachment = async (id: string, fileName?: string) => {
  const url = URL.createObjectURL(await getAttachmentBlob(id));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'file';
  link.click();
  // revoke после того, как браузер начал скачивание
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
