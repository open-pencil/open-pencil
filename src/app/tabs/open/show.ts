import { createEventHook } from '@vueuse/core'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { nextShownFrame } from '@open-pencil/vue/shared/frame'

import { applyImportedDocument } from '@/app/document/io/imported-document'
import type { EditorPreparationHandle as DocumentLoadSession } from '@/app/editor/preparation/types'
import type { EditorStore } from '@/app/editor/session'
import { rememberedDocumentView } from '@/app/recent-files'
import {
  activeTab,
  createTab,
  getActiveTabId,
  getTabForStore,
  getTabsSnapshot,
  removeTab,
  switchTab,
  type Tab
} from '@/app/tabs/state'

/**
 * A tab a document opens in: a new one, or an untouched empty design in front; never Home. A
 * restored copy is not untouched, though it has no history or source, and may still be on its way
 * to a server. `from` is the tab in front when the open began, which comes back to the front if
 * the open fails.
 */
export type OpeningTab = { store: EditorStore; created: boolean; from: Tab | undefined }

/** The tab a document opens in: the untouched empty design in front, or a new one. */
export function reusableTabStore(): OpeningTab {
  const current = activeTab.value
  const source = current?.store.getSourceIdentity()
  const isUntouched =
    current?.kind === 'document' &&
    current.store.state.documentName === 'Untitled' &&
    !current.store.undo.canUndo &&
    !current.store.hasUnsavedChanges() &&
    current.store.getStorageBinding() === null &&
    source?.path === null &&
    source.handle === null
  if (current && isUntouched) return { store: current.store, created: false, from: current }
  return { store: createTab().store, created: true, from: current }
}

/**
 * After a document failed to open, a tab opened for it closes and the tab in front before it, such
 * as Home, comes back; an empty design it reused stays. `keepRecovery` leaves the recovery copy,
 * as a failed restore must: that copy is the work being restored.
 */
export async function releaseOpeningTab(
  opening: OpeningTab,
  { keepRecovery = false }: { keepRecovery?: boolean } = {}
): Promise<void> {
  if (!opening.created) return
  const tab = getTabForStore(opening.store)
  if (!tab) return
  // The tab goes even when the recovery copy stays behind, which the next start offers again;
  // the open's own error is the one to report.
  if (!keepRecovery) await discardFailedRecovery(tab.store)
  const wasActive = getActiveTabId() === tab.id
  removeTab(tab)
  if (wasActive && opening.from && getTabsSnapshot().includes(opening.from)) {
    switchTab(opening.from.id)
  }
}

async function discardFailedRecovery(store: EditorStore): Promise<void> {
  await store.discardRecovery().catch((error: unknown) => {
    console.warn(
      '[Tabs] Failed to discard the recovery copy of a document that failed to open',
      error
    )
  })
}

const documentReplaced = createEventHook<EditorStore>()

/**
 * Hears a tab's store take another document, as when opening a file reuses an untouched tab,
 * so whatever was kept about the document it showed can be dropped.
 */
export const onTabDocumentReplaced = documentReplaced.on
/**
 * Puts an imported graph into a tab's store and shows it where it was left, or its first page
 * fitted; `prepare` runs once the document is in, before the page is shown.
 */
export async function showImportedGraph(
  store: EditorStore,
  graph: SceneGraph,
  prepare?: () => void | Promise<void>,
  load?: DocumentLoadSession
): Promise<void> {
  load?.update({ phase: 'materializing', detail: store.state.documentName })
  // The page this tab will show is prepared by switchPage below. Preparing the first page in a
  // staging editor would load its fonts twice, and an inactive Cover page stays lazy until used.
  await applyImportedDocument(store, graph, load, { prepare: false })
  void documentReplaced.trigger(store)
  load?.signal.throwIfAborted()
  await prepare?.()
  load?.signal.throwIfAborted()
  // A document opens where it was left; a new one on its first page, fitted.
  const remembered = rememberedDocumentView(store)
  const firstPageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
  const pageId = remembered?.pageId ?? firstPageId
  load?.update({ phase: 'populating-page', detail: store.graph.getNode(pageId)?.name ?? null })
  // The view is placed before the first frame counts as shown, so the loader gives way to the
  // page drawn where it opens rather than one that then moves and fills in.
  await store.switchPage(pageId, {
    preparation: load,
    beforePresentation: async () => {
      if (remembered) {
        await nextShownFrame({ signal: load?.signal })
        store.centerOn(remembered.center.x, remembered.center.y, remembered.zoom)
      } else {
        await store.fitCurrentPageToViewport(load?.signal)
      }
    }
  })
  load?.signal.throwIfAborted()
}

/** Reports a failed open on its preparation, unless the open was cancelled. */
export function failPreparation(
  load: DocumentLoadSession,
  code: 'read-failed' | 'decode-failed',
  error: unknown
): void {
  if (load.signal.aborted) return
  load.fail({
    code,
    message: error instanceof Error ? error.message : String(error),
    retryable: true
  })
}
