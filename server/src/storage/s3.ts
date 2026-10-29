import { DeleteObjectsCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';
import type { Config } from '../config';
import type { Storage } from './storage';

export const createS3Storage = (config: Pick<Config, 'S3_ENDPOINT' | 'S3_REGION' | 'S3_BUCKET' | 'S3_ACCESS_KEY' | 'S3_SECRET_KEY'>): Storage => {
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
    // MinIO не поддерживает виртуальные хосты бакетов.
    forcePathStyle: true,
  });
  const Bucket = config.S3_BUCKET;

  return {
    async put(key, body: Readable, contentType) {
      let size = 0;
      const counter = new PassThrough();
      counter.on('data', (chunk: Buffer) => {
        size += chunk.length;
      });
      body.on('error', (err) => counter.destroy(err));
      body.pipe(counter);

      // Multipart-загрузка потоком: файл целиком в памяти не держится.
      const upload = new Upload({ client, params: { Bucket, Key: key, Body: counter, ContentType: contentType } });
      try {
        await upload.done();
      } catch (err) {
        await upload.abort().catch(() => undefined);
        throw err;
      }
      return size;
    },

    async get(key, range) {
      const res = await client.send(
        new GetObjectCommand({ Bucket, Key: key, ...(range && { Range: `bytes=${range.start}-${range.end}` }) })
      );
      return { body: res.Body as Readable, contentLength: res.ContentLength ?? 0 };
    },

    async delete(keys) {
      if (!keys.length) return;
      for (let i = 0; i < keys.length; i += 1000) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket,
            Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
          })
        );
      }
    },
  };
};
