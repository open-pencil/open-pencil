import { isEqual } from 'es-toolkit'

import { executeAtomicTool } from '@open-pencil/core/editor'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import type { ToolDef } from '@open-pencil/core/tools'

import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'

/** Undo steps made through the automation bridge (MCP, CLI) start with this label. */
export const AUTOMATION_UNDO_LABEL = 'Agent'

export function automationUndoLabel(operation: string): string {
  return `${AUTOMATION_UNDO_LABEL}: ${operation}`
}

export function isAutomationUndoLabel(label: string | null): boolean {
  return label?.startsWith(`${AUTOMATION_UNDO_LABEL}: `) === true
}

/** Commit first; asynchronous font availability is presentation work, not a transaction. */
export async function executeAtomicEditorTool(
  store: EditorStore,
  figma: FigmaAPI,
  def: ToolDef,
  args: Record<string, unknown>,
  options: Parameters<typeof executeAtomicTool>[4] = {}
): Promise<unknown> {
  const result = executeAtomicTool(store, figma, def, args, options)
  const targetId = typeof args.id === 'string' ? args.id : figma.currentPageId
  if (figma.graph.getNode(targetId)?.type === 'TEXT') {
    try {
      await ensureGraphFonts(figma.graph, [targetId], store.renderer)
      if (store.graph === figma.graph && options.isLive?.() !== false) {
        store.runLayoutForNode(targetId)
        store.requestRender()
      }
    } catch (error) {
      // The edit is already committed and undoable. Font failure must not report it as failed.
      console.warn('[Agent fonts]', error)
    }
  }
  return result
}

/**
 * Run a structural edit as one undo step by snapshotting its page around it, as the AI chat
 * does, so `undo` reverts what an automation client created, moved, or deleted.
 */
export async function executeWithPageUndo<T>(
  store: EditorStore,
  pageId: string,
  label: string,
  run: () => Promise<T>
): Promise<T> {
  const before = store.snapshotPage(pageId)
  try {
    return await run()
  } finally {
    const after = store.snapshotPage(pageId)
    // Read-only scripts and no-op edits must not leave empty steps in the user's history.
    if (!isEqual(before, after)) {
      store.pushUndoEntry({
        label,
        forward: () => store.restorePageFromSnapshot(after),
        inverse: () => store.restorePageFromSnapshot(before)
      })
    }
  }
}
