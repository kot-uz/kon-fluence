import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** Тело любой ошибки API. */
export interface ErrorBody {
  message: string;
  code: string;
}

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export const notFound = (message = 'Не найдено') => new AppError(404, 'NOT_FOUND', message);

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'TOO_MANY_REQUESTS',
};

export const registerErrorHandlers = (app: FastifyInstance) => {
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ message: 'Маршрут не найден', code: 'NOT_FOUND' } satisfies ErrorBody);
  });

  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ message: error.message, code: error.code } satisfies ErrorBody);
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const message = error.validation.map((issue) => `${issue.instancePath || '/'}: ${issue.message}`).join('; ');
      return reply.code(400).send({ message, code: 'VALIDATION_ERROR' } satisfies ErrorBody);
    }
    const status = 'statusCode' in error && error.statusCode ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      return reply.code(500).send({ message: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' } satisfies ErrorBody);
    }
    return reply
      .code(status)
      .send({ message: error.message, code: STATUS_CODES[status] ?? 'BAD_REQUEST' } satisfies ErrorBody);
  });
};
