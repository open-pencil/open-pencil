import type { AutomationTarget } from '@/app/automation/bridge/target'
import { isAutomationUndoLabel } from '@/app/automation/execution/editor'
import { readAutomationSettings, updateAutomationSettings } from '@/app/settings/automation'
import { switchTab } from '@/app/tabs'

export async function handleActivateDocument(
  target: AutomationTarget,
  _args: unknown
): Promise<unknown> {
  switchTab(target.documentId)
  if (target.store.state.currentPageId !== target.pageId) {
    await target.store.switchPage(target.pageId)
  }
  return { ok: true, result: { activated: true } }
}

type HistoryDirection = 'undo' | 'redo'

// The history is shared with the person in the editor, so automation steps back only
// through its own changes, and only while they are on top.
function stepHistory(target: AutomationTarget, direction: HistoryDirection) {
  const store = target.store
  if (store.state.nodeEditState) {
    throw new Error('The document is in vector edit mode; finish editing in the app first')
  }
  const available = direction === 'undo' ? store.undo.canUndo : store.undo.canRedo
  if (!available) return { applied: false, label: null }
  const label = direction === 'undo' ? store.undo.undoLabel : store.undo.redoLabel
  if (!isAutomationUndoLabel(label)) {
    const change = direction === 'undo' ? 'last change' : 'last undone change'
    throw new Error(
      `The ${change}${label ? ` ("${label}")` : ''} was made in the editor, not through automation; ${direction} it there`
    )
  }
  if (direction === 'undo') store.undoAction()
  else store.redoAction()
  return { applied: true, label }
}

export async function handleUndo(target: AutomationTarget, _args: unknown): Promise<unknown> {
  return { ok: true, result: stepHistory(target, 'undo') }
}

export async function handleRedo(target: AutomationTarget, _args: unknown): Promise<unknown> {
  return { ok: true, result: stepHistory(target, 'redo') }
}

export function handleGetSettings(): unknown {
  return { ok: true, result: { settings: readAutomationSettings() } }
}

export function handleUpdateSettings(args: unknown): unknown {
  const settings = (args as { settings?: unknown } | undefined)?.settings
  return { ok: true, result: { settings: updateAutomationSettings(settings ?? {}) } }
}
