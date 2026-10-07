import * as v from 'valibot'

import { parseToolArgs } from '@open-pencil/core/tools'

import {
  resolveAutomationTarget,
  responseWithTarget,
  type AutomationTarget
} from '@/app/automation/bridge/target'
import { resolveBrowserFileURL } from '@/app/document/io/browser'
import { openBrowserFileFromURL } from '@/app/shell/menu/files'
import { openFileFromPath } from '@/app/shell/menu/use'
import { closeTab, createTab, getActiveStore, getTabById } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'

const saveArgsSchema = v.object({ path: v.optional(v.string()) })

const closeArgsSchema = v.object({
  path: v.optional(v.string()),
  unsaved: v.optional(v.picklist(['error', 'save', 'discard']), 'error')
})

// Automation never opens the Save dialog: nobody may be there to answer it.
async function saveWithoutPrompt(store: AutomationTarget['store'], path?: string): Promise<void> {
  const name = store.state.documentName
  if (!path && !store.hasWritableSource()) {
    throw new Error(`"${name}" has not been saved to a file yet; pass a path to save it`)
  }
  if (path) await ensureTauriParentDirectory(path)
  // A failed save to a new path leaves the document with the source it had.
  const saved = path ? await store.saveFigFileToPath(path) : await store.saveFigFile()
  if (!saved) throw new Error(`Could not save "${name}"`)
}

export async function handleSaveFile(target: AutomationTarget, args: unknown): Promise<unknown> {
  const { path } = parseToolArgs('save_file', saveArgsSchema, args)
  await saveWithoutPrompt(target.store, path)
  return { ok: true, result: { saved: true } }
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

export async function handleCloseFile(target: AutomationTarget, args: unknown): Promise<unknown> {
  const { path, unsaved } = parseToolArgs('close_file', closeArgsSchema, args)
  const store = target.store
  if (store.hasUnsavedChanges()) {
    if (unsaved === 'error') {
      throw new Error(
        `"${store.state.documentName}" has unsaved changes. ` +
          'Save or discard them: CLI --save or --discard, MCP unsaved "save" or "discard"'
      )
    }
    if (unsaved === 'save') await saveWithoutPrompt(store, path)
  }
  await closeTab(target.documentId, unsaved === 'discard' ? 'discard' : 'save')
  return { ok: true, result: { closed: getTabById(target.documentId) === undefined } }
}

export async function handleNewDocument(
  _target: AutomationTarget,
  args: unknown
): Promise<unknown> {
  const { path } = parseToolArgs('new_document', saveArgsSchema, args)
  const tab = createTab()
  if (path) {
    try {
      await saveWithoutPrompt(tab.store, path)
    } catch (error) {
      await closeTab(tab.id, 'discard')
      throw error
    }
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
    // Same fetch, cap and format check as every other browser open: an automation client
    // is not more trusted than a link.
    await openBrowserFileFromURL(resolveBrowserFileURL(path))
  }
  const target = resolveAutomationTarget(getActiveStore(), undefined)
  return responseWithTarget({ ok: true, result: { opened: true } }, target)
}
