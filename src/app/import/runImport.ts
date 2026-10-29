import httpClient from 'app/helpers/httpClient';
import { getDb } from 'app/docs/local/db';
import type { LocalUserData } from 'app/docs/local/userData';
import type { PageDraft } from 'app/docs/types';
import { buildCommitBody, collectFileIds } from './buildImport';
import { readImportState, writeImportState } from './importState';

/** Сколько файлов грузится одновременно. */
const UPLOAD_CONCURRENCY = 3;

export type ImportStage = 'upload' | 'commit';

export interface ImportProgress {
  stage: ImportStage;
  /** Загружено файлов из общего числа. */
  done: number;
  total: number;
}

/** Выполняет задачи не более чем в `limit` потоков; при первой ошибке новые не запускаются. */
const runPool = async <T>(items: T[], limit: number, task: (item: T) => Promise<void>) => {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const item = items[(next += 1) - 1];
      try {
        // eslint-disable-next-line no-await-in-loop
        await task(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

const uploadFile = async (importId: string, localId: string) => {
  const record = await (await getDb()).get('attachments', localId);
  if (!record) return;
  const form = new FormData();
  // localId должен идти до файла: сервер отсекает повтор, не читая поток
  form.append('localId', localId);
  form.append('file', record.blob, record.fileName);
  await httpClient.post(`/docs/Imports/${importId}/Attachments`, form);
};

const createSession = async () => {
  const { data } = await httpClient.post<{ importId: string }>('/docs/Imports');
  return data.importId;
};

/**
 * Переносит данные устройства в аккаунт: файлы по 3 параллельно, затем commit.
 * Сессия и список загруженных файлов хранятся в localStorage, поэтому после ошибки
 * повторный вызов продолжает с того же места. Истёкшая сессия (410) начинается заново.
 */
export const runImport = async (
  userId: string,
  data: LocalUserData,
  drafts: Map<string, PageDraft>,
  onProgress: (progress: ImportProgress) => void
) => {
  const body = buildCommitBody(data, drafts);
  // грузим только то, на что ссылается итоговое содержимое (в том числе из черновиков)
  const fileIds = new Set(body.pages.flatMap((page) => collectFileIds(page.content)));
  const stored = readImportState(userId);
  let importId = stored?.decision === 'started' ? stored.importId : undefined;
  let uploaded = new Set(importId ? stored?.uploaded : []);

  const save = () => writeImportState(userId, { decision: 'started', importId, uploaded: [...uploaded] });
  const start = async () => {
    importId = await createSession();
    uploaded = new Set();
    save();
  };

  const attempt = async () => {
    if (!importId) await start();
    const pending = [...fileIds].filter((id) => !uploaded.has(id));
    const total = fileIds.size;
    onProgress({ stage: 'upload', done: total - pending.length, total });
    await runPool(pending, UPLOAD_CONCURRENCY, async (localId) => {
      await uploadFile(importId!, localId);
      uploaded.add(localId);
      save();
      onProgress({ stage: 'upload', done: uploaded.size, total });
    });
    onProgress({ stage: 'commit', done: total, total });
    await httpClient.post(`/docs/Imports/${importId}/Commit`, body);
  };

  try {
    await attempt();
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status !== 410 && status !== 404) throw error;
    // сессия истекла или удалена: загруженные в неё файлы потеряны
    importId = undefined;
    await attempt();
  }
  writeImportState(userId, { decision: 'done' });
};
