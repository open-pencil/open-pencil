import type { RecordEditOptions } from '@open-pencil/core'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { graphOf } from '@open-pencil/core/figma-api'

import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'

import { acquireDocumentEdit } from './lock'

/** Undo steps made through the automation bridge (MCP, CLI) start with this label. */
export const AUTOMATION_UNDO_LABEL = 'Agent'

export function automationUndoLabel(operation: string): string {
  return `${AUTOMATION_UNDO_LABEL}: ${operation}`
}

export function isAutomationUndoLabel(label: string | null): boolean {
  return label?.startsWith(`${AUTOMATION_UNDO_LABEL}: `) === true
}

/**
 * Loads the fonts a committed atomic edit drew its text in. This is presentation work after the
 * edit's step, not part of it, so it runs outside the edit.
 */
export async function loadAtomicToolFonts(
  store: EditorStore,
  figma: FigmaAPI,
  args: Record<string, unknown>,
  options: { isLive?: () => boolean } = {}
): Promise<void> {
  const targetId = typeof args.id === 'string' ? args.id : figma.currentPageId
  if (graphOf(figma).getNode(targetId)?.type === 'TEXT') {
    try {
      await ensureGraphFonts(graphOf(figma), [targetId], store.renderer)
      if (store.graph === graphOf(figma) && options.isLive?.() !== false) {
        store.runLayoutForNode(targetId)
        store.requestRender()
      }
    } catch (error) {
      // The edit is already committed and undoable. Font failure must not report it as failed.
      console.warn('[Agent fonts]', error)
    }
  }
}

interface AgentEditOptions {
  /** False once the edit's document closed, so a late layout is not drawn. */
  isLive?: () => boolean
  /** Aborts once the caller stops waiting; an edit cancelled before it commits is rolled back. */
  signal?: AbortSignal
  /**
   * Runs once the step is recorded, before fonts load, such as releasing the document's lock so
   * the next call need not wait for this one's fonts.
   */
  afterStep?: () => void | Promise<void>
}

/**
 * Runs an agent's edit as one undo step of what it wrote and the layout that follows, with no
 * wait between them. Loading the fonts its page draws text in and laying it out again come after
 * the step closes: they are presentation, and what anyone else changes while fonts load must not
 * land in the agent's step. A font that fails to load leaves the edit standing.
 */
export async function recordAgentEdit<T>(
  store: EditorStore,
  options: RecordEditOptions & { pageId: string },
  run: () => T | Promise<T>,
  { isLive, signal, afterStep }: AgentEditOptions = {}
): Promise<T> {
  const { result, relayout } = await store.recordEditAsync(options, async () => {
    const edited = await store.runMutationWithLayout(run, options.pageId)
    // Cancelled while it ran, such as by an MCP timeout during a download: nothing is committed.
    signal?.throwIfAborted()
    return edited
  })
  await afterStep?.()
  try {
    const page = store.graph.getNode(options.pageId)
    const loaded = page && (await ensureGraphFonts(store.graph, page.childIds, store.renderer))
    if (loaded && isLive?.() !== false) {
      relayout()
      store.requestRender()
    }
  } catch (error) {
    console.warn('[Agent fonts]', error)
  }
  return result
}

/**
 * Runs an agent's script as one undo step of what it changes anywhere in the document, so `undo`
 * reverts what it created, moved, or deleted on any page, and the variables it changed. It waits
 * for the document's other agent edits, as tool calls do, so neither records the other's changes;
 * cancelled while it waits, it never runs, and cancelled while it runs, it is rolled back. The
 * next edit's turn comes once the step is recorded, not after its fonts load.
 */
export async function executeWithDocumentUndo<T>(
  store: EditorStore,
  pageId: string,
  label: string,
  run: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const graph = store.graph
  const release = await acquireDocumentEdit(store, signal)
  try {
    signal?.throwIfAborted()
    // The script's API edits the document it was given; one reloaded meanwhile is another.
    if (store.graph !== graph) throw new Error('The document was replaced before the script ran')
    return await recordAgentEdit(store, { label, pageId }, run, { signal, afterStep: release })
  } finally {
    release()
  }
}
