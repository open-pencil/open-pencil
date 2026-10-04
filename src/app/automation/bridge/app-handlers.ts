import type { AutomationTarget } from '@/app/automation/bridge/target'
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

// Mirrors the Edit menu: vector edit mode keeps its own session history.
function stepHistory(target: AutomationTarget, direction: HistoryDirection) {
  const store = target.store
  if (store.state.nodeEditState) {
    const applied = direction === 'undo' ? store.nodeEditUndo() : store.nodeEditRedo()
    return { applied, label: null, scope: 'vector-edit' }
  }
  const available = direction === 'undo' ? store.undo.canUndo : store.undo.canRedo
  if (!available) return { applied: false, label: null, scope: 'document' }
  const label = direction === 'undo' ? store.undo.undoLabel : store.undo.redoLabel
  if (direction === 'undo') store.undoAction()
  else store.redoAction()
  return { applied: true, label, scope: 'document' }
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
