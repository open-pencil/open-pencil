import {
  resolveAutomationTarget,
  responseWithTarget,
  type AutomationTarget
} from '@/app/automation/bridge/target'
import { mcpOpenFileClosesOtherTabs } from '@/app/automation/mcp/preferences'
import { resolveBrowserFileURL } from '@/app/document/io/browser'
import { openFileFromPath } from '@/app/shell/menu/use'
import {
  closeOtherTabs,
  closeTab,
  createTab,
  getActiveStore,
  getActiveTabId,
  getTabById,
  openFileInNewTab
} from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'

export async function handleSaveFile(target: AutomationTarget, args: unknown): Promise<unknown> {
  const store = target.store
  const path = (args as { path?: string }).path
  if (path) {
    store.setPlannedFilePath(path)
    await ensureTauriParentDirectory(path)
  }
  await store.saveFigFile()
  if (path) store.startWatchingCurrentFile()
  return { ok: true }
}

export async function ensureTauriParentDirectory(path: string): Promise<void> {
  if (!isTauri()) return
  const [{ dirname }, { mkdir }] = await Promise.all([
    import('@tauri-apps/api/path'),
    import('@tauri-apps/plugin-fs')
  ])
  const dir = await dirname(path)
  if (dir === path) return
  await mkdir(dir, { recursive: true })
}

export async function handleNewDocument(
  _target: AutomationTarget,
  args: unknown
): Promise<unknown> {
  const path = (args as { path?: string }).path
  const tab = createTab()
  if (path) {
    tab.store.setPlannedFilePath(path)
    await ensureTauriParentDirectory(path)
    await tab.store.saveFigFile()
    tab.store.startWatchingCurrentFile()
  }
  const target = resolveAutomationTarget(tab.store, { document_id: tab.id })
  return responseWithTarget({ ok: true, result: { created: true } }, target)
}

export async function handleOpenFile(_target: AutomationTarget, args: unknown): Promise<unknown> {
  const path = (args as { path?: string }).path
  if (!path) throw new Error('Missing "path" in args')
  if (isTauri()) {
    await openFileFromPath(path)
  } else {
    const resourceURL = resolveBrowserFileURL(path)
    const response = await fetch(resourceURL)
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`)
    const name = resourceURL.pathname.split('/').pop() ?? 'file.fig'
    const file = new File([await response.blob()], name)
    await openFileInNewTab(file, undefined, resourceURL.href)
  }
  if (mcpOpenFileClosesOtherTabs.value) await closeOtherTabs(getActiveTabId())
  const target = resolveAutomationTarget(getActiveStore(), undefined)
  return responseWithTarget({ ok: true, result: { opened: true } }, target)
}

export async function handleCloseFile(_target: AutomationTarget, args: unknown): Promise<unknown> {
  const documentId = (args as { document_id?: string }).document_id
  if (!documentId) throw new Error('Missing "document_id" in args')
  const tab = getTabById(documentId)
  if (!tab || tab.kind !== 'document') throw new Error(`Document "${documentId}" not found`)
  const documentName = tab.store.state.documentName
  await closeTab(tab.id)
  return { ok: true, result: { closed: true, document_id: documentId, name: documentName } }
}
