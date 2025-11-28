import type { RequestDraft } from '../types';

const STORAGE_KEY = 'api-extractor-request-drafts';

const readDrafts = (): RequestDraft[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

const writeDrafts = (drafts: RequestDraft[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
};

export const RequestDraftService = {
  list(): RequestDraft[] {
    return readDrafts().sort((a, b) => b.updatedAt - a.updatedAt);
  },
  save(draft: RequestDraft): RequestDraft {
    const drafts = readDrafts();
    const existingIndex = drafts.findIndex((d) => d.id === draft.id);
    const normalized: RequestDraft = {
      ...draft,
      updatedAt: Date.now(),
    };
    if (existingIndex >= 0) {
      drafts[existingIndex] = normalized;
    } else {
      drafts.unshift(normalized);
    }
    writeDrafts(drafts.slice(0, 100));
    return normalized;
  },
  delete(id: string): void {
    const drafts = readDrafts().filter((draft) => draft.id !== id);
    writeDrafts(drafts);
  },
  get(id: string): RequestDraft | null {
    return readDrafts().find((draft) => draft.id === id) || null;
  },
};

