import { validateContent, type DocContent } from '@kon-fluence/shared';
import { z } from 'zod';
import { AppError } from '../errors';

export const MAX_IMPORT_SPACES = 1000;
export const MAX_IMPORT_PAGES = 20_000;
export const MAX_IMPORT_ATTACHMENTS = 5000;
/** Время жизни сессии импорта. */
export const IMPORT_TTL_MS = 24 * 60 * 60 * 1000;

const localId = z.string().min(1).max(255);
const authorName = z.string().trim().max(255);
const date = z.iso.datetime({ offset: true });

const contentSchema = z.custom<DocContent>().superRefine((value, ctx) => {
  const error = validateContent(value);
  if (error) ctx.addIssue({ code: 'custom', message: error });
});

export const commitBodySchema = z.object({
  spaces: z
    .array(
      z.object({
        localId,
        type: z.enum(['space', 'project']).default('space'),
        title: z.string().trim().min(1, 'Укажите название').max(255),
        createdAt: date.optional(),
      })
    )
    .max(MAX_IMPORT_SPACES),
  pages: z
    .array(
      z.object({
        localId,
        spaceLocalId: localId,
        parentLocalId: localId.nullish(),
        position: z.number().finite().optional(),
        title: z.string().trim().min(1, 'Укажите название').max(255),
        content: contentSchema,
        createdAt: date.optional(),
        updatedAt: date.optional(),
        createdByName: authorName.optional(),
        updatedByName: authorName.optional(),
      })
    )
    .max(MAX_IMPORT_PAGES),
});

export type CommitBody = z.infer<typeof commitBodySchema>;
export type ImportPage = CommitBody['pages'][number];

const invalid = (code: string, message: string) => new AppError(400, code, message);

/**
 * Проверяет локальные id, принадлежность страниц пространствам и родителей.
 * Возвращает страницы в порядке «родитель раньше детей».
 */
export const orderPages = ({ spaces, pages }: CommitBody): ImportPage[] => {
  const spaceIds = new Set<string>();
  for (const space of spaces) {
    if (spaceIds.has(space.localId)) throw invalid('DUPLICATE_ID', `Повтор id пространства: ${space.localId}`);
    spaceIds.add(space.localId);
  }

  const byId = new Map<string, ImportPage>();
  for (const page of pages) {
    if (byId.has(page.localId)) throw invalid('DUPLICATE_ID', `Повтор id страницы: ${page.localId}`);
    if (!spaceIds.has(page.spaceLocalId)) throw invalid('SPACE_NOT_FOUND', `Пространство не найдено: ${page.spaceLocalId}`);
    byId.set(page.localId, page);
  }

  for (const page of pages) {
    if (!page.parentLocalId) continue;
    const parent = byId.get(page.parentLocalId);
    if (!parent || parent.spaceLocalId !== page.spaceLocalId) {
      throw invalid('PARENT_NOT_FOUND', `Родитель страницы ${page.localId} не найден в её пространстве`);
    }
  }

  // Обход вверх по родителям: повторная встреча страницы из текущего пути — цикл.
  const ordered: ImportPage[] = [];
  const done = new Set<string>();
  for (const start of pages) {
    const path: ImportPage[] = [];
    const inPath = new Set<string>();
    for (let page: ImportPage | undefined = start; page && !done.has(page.localId); page = page.parentLocalId ? byId.get(page.parentLocalId) : undefined) {
      if (inPath.has(page.localId)) throw invalid('PARENT_CYCLE', `Цикл в дереве страниц: ${page.localId}`);
      inPath.add(page.localId);
      path.push(page);
    }
    for (const page of path.reverse()) {
      done.add(page.localId);
      ordered.push(page);
    }
  }
  return ordered;
};

const FILE_ID_ATTR = 'fileId';

/** Все `fileId` из содержимого страницы. */
export const collectFileIds = (content: DocContent): string[] => {
  const ids: string[] = [];
  const visit = (node: DocContent) => {
    const id = node.attrs?.[FILE_ID_ATTR];
    if (typeof id === 'string' && id) ids.push(id);
    node.content?.forEach(visit);
  };
  visit(content);
  return ids;
};

const isRelativeHref = (href: string) => href.startsWith('/') || href.startsWith('#');

/** Внутренняя ссылка — относительный href, где сегмент пути равен локальному id страницы. */
const rewriteHref = (href: string, pageIds: Map<string, string>) =>
  isRelativeHref(href) ? href.replace(/[^/#?]+/g, (segment) => pageIds.get(segment) ?? segment) : href;

/** Копия содержимого, где `fileId` и внутренние ссылки заменены серверными id. */
export const rewriteContent = (content: DocContent, fileIds: Map<string, string>, pageIds: Map<string, string>): DocContent => {
  const visit = (node: DocContent): DocContent => {
    let next = node;
    const fileId = node.attrs?.[FILE_ID_ATTR];
    if (typeof fileId === 'string' && fileId) {
      next = { ...next, attrs: { ...next.attrs, [FILE_ID_ATTR]: fileIds.get(fileId) ?? fileId } };
    }
    if (node.marks?.some((mark) => typeof mark.attrs?.href === 'string')) {
      next = {
        ...next,
        marks: node.marks.map((mark) =>
          typeof mark.attrs?.href === 'string' ? { ...mark, attrs: { ...mark.attrs, href: rewriteHref(mark.attrs.href, pageIds) } } : mark
        ),
      };
    }
    return next.content ? { ...next, content: next.content.map(visit) } : next;
  };
  return visit(content);
};
