import { shallowReactive, shallowRef } from 'vue'

import type { DocumentVersion } from '@open-pencil/cloud/contract'

import { createEditorStore, type EditorStore } from '@/app/editor/session'
import { downloadCloudDocument } from '@/app/integrations/storage/cloud/download'
import { storageFetch } from '@/app/integrations/storage/s3/fetch'
import { readFigBytes } from '@/app/tabs'

import { cloudShareTarget } from '../sharing/document'

/** An earlier version shown in place of the document, in an editor of its own. */
export type VersionPreview = { version: DocumentVersion; store: EditorStore }

/**
 * A tab's open version history. The document is read-only while it is open, as in Figma; a
 * previewed version gets its own read-only editor, so the document and its room carry on beneath.
 */
export type VersionHistory = {
  store: EditorStore
  /** Whether the document was read-only before, as for a viewer, to put back on closing. */
  wasReadOnly: boolean
  preview: VersionPreview | null
  /** The version being opened for preview. */
  opening: string | null
  /** Whether the last preview could not be opened. */
  failed: boolean
}

const histories = shallowRef<ReadonlyMap<EditorStore, VersionHistory>>(new Map())

/** The version info dialog: naming the document as it is now, or editing a version's info. */
export type VersionDialog = { store: EditorStore; version: DocumentVersion | null }
export const versionDialog = shallowRef<VersionDialog | null>(null)

/** Each document's history changes so far, here or anywhere the server says. */
const listRevisions = shallowReactive(new WeakMap<EditorStore, number>())

/** How often the history of the document `store` shows has changed, so its open list reloads. */
export function versionListRevision(store: EditorStore): number {
  return listRevisions.get(versionHistoryOf(store)?.store ?? store) ?? 0
}

/** The history of the document `store` shows changed, so its open list loads it again. */
export function versionsChanged(store: EditorStore): void {
  const document = versionHistoryOf(store)?.store ?? store
  listRevisions.set(document, (listRevisions.get(document) ?? 0) + 1)
}
/** Each tab's preview download in flight, keyed by its document. */
const previewLoads = new Map<EditorStore, AbortController>()

function update(store: EditorStore, next: VersionHistory | null) {
  const map = new Map(histories.value)
  if (next) map.set(store, next)
  else map.delete(store)
  histories.value = map
}

/** The open history that `store` is the document or the previewed version of. */
export function versionHistoryOf(store: EditorStore): VersionHistory | undefined {
  const own = histories.value.get(store)
  if (own) return own
  for (const history of histories.value.values()) {
    if (history.preview?.store === store) return history
  }
  return undefined
}

export function isVersionHistoryOpen(store: EditorStore): boolean {
  return versionHistoryOf(store) !== undefined
}

/** Opens the version info dialog, as Save to version history or a version's Edit version info. */
export function openVersionDialog(
  store: EditorStore,
  version: DocumentVersion | null = null
): void {
  versionDialog.value = { store: versionHistoryOf(store)?.store ?? store, version }
}

/** A key that changes whenever the tab of `store` shows another version or the document again. */
export function versionPreviewKey(store: EditorStore): string {
  return histories.value.get(store)?.preview?.version.id ?? ''
}

/** What the tab of `store` shows: the previewed version while there is one, else the document. */
export function shownEditorStore(store: EditorStore): EditorStore {
  return histories.value.get(store)?.preview?.store ?? store
}

function endPreview(history: VersionHistory) {
  previewLoads.get(history.store)?.abort()
  previewLoads.delete(history.store)
  const preview = history.preview
  if (!preview) return
  preview.store.preparationController.dispose()
  preview.store.dispose()
}

export function openVersionHistory(store: EditorStore): void {
  if (histories.value.has(store)) return
  update(store, {
    store,
    wasReadOnly: store.state.hostRestrictions.readOnly,
    preview: null,
    opening: null,
    failed: false
  })
  store.setReadOnly(true)
}

export function closeVersionHistory(store: EditorStore): void {
  const history = versionHistoryOf(store)
  if (!history) return
  endPreview(history)
  update(history.store, null)
  history.store.setReadOnly(history.wasReadOnly)
}

/** Back to the document as it is now, keeping the history open. */
export function showCurrentVersion(store: EditorStore): void {
  const history = versionHistoryOf(store)
  if (!history) return
  endPreview(history)
  update(history.store, { ...history, preview: null, opening: null, failed: false })
}

/**
 * Shows an earlier version where the document was, on the same page and at the same view where
 * the version has that page.
 */
export async function previewVersion(store: EditorStore, version: DocumentVersion): Promise<void> {
  const history = versionHistoryOf(store)
  const binding = history?.store.getStorageBinding()
  const target = binding && cloudShareTarget(binding)
  if (!history || !target) return
  if (version.current) {
    showCurrentVersion(store)
    return
  }
  previewLoads.get(history.store)?.abort()
  const load = new AbortController()
  previewLoads.set(history.store, load)
  update(history.store, { ...history, opening: version.id, failed: false })
  const document = history.store
  let preview: EditorStore
  try {
    const { document: download } = await target.client.getDocumentVersion(
      target.documentId,
      version.id
    )
    const bytes = await downloadCloudDocument(download, storageFetch, { signal: load.signal })
    const name = document.state.documentName
    preview = createEditorStore(await readFigBytes(bytes, name, load.signal))
    preview.state.documentName = name
    preview.setReadOnly(true)
  } catch (error) {
    if (load.signal.aborted) return
    update(history.store, { ...history, opening: null, failed: true })
    console.warn('[Cloud] Opening a version failed:', error)
    return
  }
  if (load.signal.aborted) {
    preview.dispose()
    return
  }
  previewLoads.delete(document)
  const current = versionHistoryOf(document)
  if (!current) {
    preview.dispose()
    return
  }
  endPreview(current)
  update(document, { ...current, preview: { version, store: preview }, opening: null })
  // The version still shows where the document's page is missing or does not open.
  void keepPlace(preview, document).catch(() => undefined)
}

/**
 * Once the version shows, it opens at the document's view, on the page in the same place in its
 * page list; a `.fig` read gives every page a new ID, so the place is what they share.
 */
async function keepPlace(preview: EditorStore, document: EditorStore) {
  const { currentPageId, panX, panY, zoom } = document.state
  const index = document.graph.getPages().findIndex((page) => page.id === currentPageId)
  const page = index === -1 ? undefined : preview.graph.getPages().at(index)
  if (!page) return
  await preview.canvasReady
  if (preview.state.currentPageId !== page.id) await preview.switchPage(page.id)
  Object.assign(preview.state, { panX, panY, zoom })
  preview.requestRepaint()
}
