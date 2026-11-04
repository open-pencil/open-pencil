import type { DocumentKind } from '@open-pencil/scene-graph'

/** Which files a list shows: every file, or one kind of them. */
export type DocumentKindFilter = 'all' | DocumentKind

/** Whether a file of `kind` passes `filter`. */
export function ofKind(kind: DocumentKind, filter: DocumentKindFilter): boolean {
  return filter === 'all' || kind === filter
}
