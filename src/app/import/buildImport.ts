import type { DocContent } from '@kon-fluence/shared';
import { readStorage } from 'app/docs/utils/storage';
import type { LocalUserData } from 'app/docs/local/userData';
import type { PageDraft } from 'app/docs/types';

/** Тело `POST /docs/Imports/{importId}/Commit`. */
export interface CommitBody {
  spaces: { localId: string; type: 'space' | 'project'; title: string; createdAt?: string }[];
  pages: {
    localId: string;
    spaceLocalId: string;
    parentLocalId: string | null;
    position: number;
    title: string;
    content: DocContent;
    createdAt: string;
    updatedAt: string;
    createdByName: string;
    updatedByName: string;
  }[];
}

export const getDraftKey = (pageId: string) => `docs-draft:${pageId}`;

/** Несохранённые черновики страниц, которые попадут в перенос. */
export const findDrafts = (data: LocalUserData) => {
  const drafts = new Map<string, PageDraft>();
  data.pages.forEach((page) => {
    const draft = readStorage<PageDraft | null>(getDraftKey(page.id), null);
    if (draft?.content) drafts.set(page.id, draft);
  });
  return drafts;
};

/** Все `fileId` из содержимого страницы. */
export const collectFileIds = (content: DocContent): string[] => {
  const ids: string[] = [];
  const visit = (node: DocContent) => {
    const id = node.attrs?.fileId;
    if (typeof id === 'string' && id) ids.push(id);
    node.content?.forEach(visit);
  };
  visit(content);
  return ids;
};

/**
 * Собирает тело commit. Черновик заменяет название и содержимое страницы:
 * иначе правки, не доехавшие до сохранения, остались бы только на устройстве.
 */
export const buildCommitBody = (data: LocalUserData, drafts: Map<string, PageDraft>): CommitBody => {
  // пространства со страницами, которых нет среди перечисленных, добавляются ниже
  const spaces: CommitBody['spaces'] = data.spaces.map((space) => ({
    localId: `space:${space.id}`,
    type: 'space',
    title: space.title,
    ...(space.createdAt && { createdAt: space.createdAt }),
  }));
  const spaceIds = new Set(spaces.map((space) => space.localId));

  const pages: CommitBody['pages'] = data.pages.map((page) => {
    const draft = drafts.get(page.id);
    const spaceLocalId = `${page.spaceType}:${page.spaceId}`;
    if (!spaceIds.has(spaceLocalId)) {
      spaceIds.add(spaceLocalId);
      spaces.push({
        localId: spaceLocalId,
        type: page.spaceType,
        title: data.spaceTitles[spaceLocalId] ?? page.spaceId,
      });
    }
    return {
      localId: page.id,
      spaceLocalId,
      parentLocalId: page.parentId,
      position: page.position,
      title: draft?.title.trim() || page.title,
      content: draft?.content ?? page.content,
      createdAt: page.createdAt,
      updatedAt: draft?.savedAt ?? page.updatedAt,
      createdByName: page.createdBy.fullName,
      updatedByName: page.updatedBy.fullName,
    };
  });
  return { spaces, pages };
};
