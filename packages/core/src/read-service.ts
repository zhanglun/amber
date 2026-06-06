import type { Capture, CaptureSummary, Store } from "@amber/domain";
import { normalizeTags } from "./tags.js";

export class ReadService {
  constructor(private readonly store: Store) {}

  list(): Promise<CaptureSummary[]> {
    return this.store.list();
  }

  get(id: string): Promise<Capture | null> {
    return this.store.get(id);
  }

  findBySourceUrl(url: string): Promise<Capture | null> {
    return this.store.findBySourceUrl(url);
  }

  updateReadStatus(
    id: string,
    status: { readProgress: number; readAt?: string }
  ): Promise<void> {
    return this.store.updateReadStatus(id, status);
  }

  updateTags(id: string, tags: string[]): Promise<void> {
    return this.store.updateTags(id, normalizeTags(tags));
  }

  recordVisit(id: string, visitedAt: string): Promise<void> {
    return this.store.recordVisit(id, visitedAt);
  }
}
