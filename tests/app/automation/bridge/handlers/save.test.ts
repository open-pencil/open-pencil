import 'fake-indexeddb/auto'
import { describe, expect, test, vi } from 'bun:test'

import { asDouble } from '@open-pencil/test-support/doubles'

import * as saveTargets from '@/app/document/io/save/targets'
import { createTab, getTabById } from '@/app/tabs'

import { request, useAutomationHandlerGlobals } from '#tests/helpers/automation/handlers'

useAutomationHandlerGlobals()

describe('close_document and save_document never prompt', () => {
  function dirtyTab() {
    const tab = createTab()
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    expect(tab.store.hasUnsavedChanges()).toBe(true)
    return tab
  }

  test('closing unsaved changes fails unless the caller chooses', async () => {
    const tab = dirtyTab()
    await expect(request('close_document', { document_id: tab.id })).rejects.toThrow(
      'has unsaved changes'
    )
    expect(getTabById(tab.id)).toBeDefined()

    const closed = await request('close_document', { document_id: tab.id, unsaved: 'discard' })
    expect(closed.result).toEqual({ closed: true })
    expect(getTabById(tab.id)).toBeUndefined()
  })

  test('saving a document that has no file asks for a path instead of a dialog', async () => {
    const tab = dirtyTab()
    await expect(request('save_document', { document_id: tab.id })).rejects.toThrow(
      'has not been saved to a file yet'
    )
    await expect(
      request('close_document', { document_id: tab.id, unsaved: 'save' })
    ).rejects.toThrow('has not been saved to a file yet')
    expect(getTabById(tab.id)).toBeDefined()
  })

  test('a failed save to a path keeps the document source it had', async () => {
    const tab = dirtyTab()
    // Outside Tauri a path cannot be written, so the save fails.
    await expect(
      request('save_document', { document_id: tab.id, path: '/tmp/never-written.fig' })
    ).rejects.toThrow('Could not save')
    expect(tab.store.state.documentName).toBe('Untitled')
    expect(tab.store.getDocumentFilePath()).toBeNull()
    expect(tab.store.hasWritableSource()).toBe(false)
  })

  function recordNativeFs(): string[] {
    const commands: string[] = []
    Object.assign(window, {
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args?: { path?: string }) => {
          commands.push(cmd)
          if (cmd !== 'plugin:path|dirname') return null
          const path = args?.path ?? ''
          const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
          return slash > 0 ? path.slice(0, slash) : path
        }
      }
    })
    return commands
  }

  function fsWrites(commands: string[]): string[] {
    return commands.filter((cmd) => cmd === 'plugin:fs|mkdir' || cmd === 'plugin:fs|write_file')
  }

  test('a native save to a non-.fig path does not create a directory or write the file', async () => {
    const commands = recordNativeFs()
    const tab = dirtyTab()
    await expect(
      request('save_document', { document_id: tab.id, path: '/tmp/nested/never-written.pen' })
    ).rejects.toThrow('"/tmp/nested/never-written.fig"')
    expect(fsWrites(commands)).toEqual([])
    expect(tab.store.getDocumentFilePath()).toBeNull()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('a native save to a .fig path creates the directory and writes the file', async () => {
    const commands = recordNativeFs()
    const tab = dirtyTab()
    await request('save_document', { document_id: tab.id, path: '/tmp/nested/saved.fig' })
    expect(fsWrites(commands)).toEqual(['plugin:fs|mkdir', 'plugin:fs|write_file'])
    expect(tab.store.hasUnsavedChanges()).toBe(false)
  })

  test('saving over an existing .pen file writes nothing', async () => {
    const commands = recordNativeFs()
    const tab = dirtyTab()
    tab.store.setPlannedFilePath('/tmp/notes.pen')
    expect(tab.store.hasWritableSource()).toBe(true)
    await expect(request('save_document', { document_id: tab.id })).rejects.toThrow(
      '"/tmp/notes.fig"'
    )
    expect(fsWrites(commands)).toEqual([])
    expect(tab.store.getDocumentFilePath()).toBe('/tmp/notes.pen')
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('closing with save over an extensionless file writes nothing and keeps the tab', async () => {
    const commands = recordNativeFs()
    const tab = dirtyTab()
    tab.store.setPlannedFilePath('/tmp/notes')
    await expect(
      request('close_document', { document_id: tab.id, unsaved: 'save' })
    ).rejects.toThrow('"/tmp/notes.fig"')
    expect(fsWrites(commands)).toEqual([])
    expect(getTabById(tab.id)).toBeDefined()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('saving a document opened from a .pen file names the .fig beside it', async () => {
    const commands = recordNativeFs()
    const tab = createTab()
    tab.store.setDocumentSource('notes.pen', 'pen', undefined, '/tmp/designs/notes.pen')
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    expect(tab.store.hasWritableSource()).toBe(false)
    await expect(request('save_document', { document_id: tab.id })).rejects.toThrow(
      '"/tmp/designs/notes.fig"'
    )
    expect(fsWrites(commands)).toEqual([])
    await request('save_document', { document_id: tab.id, path: '/tmp/designs/notes.fig' })
    expect(tab.store.hasUnsavedChanges()).toBe(false)
  })

  function tabWithHandle(name: string) {
    const opened = { count: 0 }
    const handle = asDouble<FileSystemFileHandle>({
      name,
      getFile: async () => asDouble<File>({ lastModified: 0 }),
      createWritable: async () => {
        opened.count += 1
        return asDouble<FileSystemWritableFileStream>(new WritableStream<Uint8Array>())
      }
    })
    const tab = createTab()
    tab.store.setDocumentSource(name, 'fig', handle)
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    return { tab, opened }
  }

  test('saving over a .pen browser handle does not open it for writing', async () => {
    const { tab, opened } = tabWithHandle('notes.pen')
    expect(tab.store.getDocumentFilePath()).toBeNull()
    expect(tab.store.hasWritableSource()).toBe(true)
    await expect(request('save_document', { document_id: tab.id })).rejects.toThrow()
    expect(opened.count).toBe(0)
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('closing with save over a .pen browser handle does not open it for writing', async () => {
    const { tab, opened } = tabWithHandle('notes.pen')
    await expect(
      request('close_document', { document_id: tab.id, unsaved: 'save' })
    ).rejects.toThrow()
    expect(opened.count).toBe(0)
    expect(getTabById(tab.id)).toBeDefined()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('saving over a .fig browser handle still writes', async () => {
    const { tab, opened } = tabWithHandle('notes.fig')
    await request('save_document', { document_id: tab.id })
    expect(opened.count).toBe(1)
    expect(tab.store.hasUnsavedChanges()).toBe(false)
  })

  /** Save As installs this handle, then the first open fails and later opens write. */
  function pickedHandle(name: string) {
    const calls = { createWritable: 0, written: 0 }
    let fail = true
    const handle = asDouble<FileSystemFileHandle>({
      kind: 'file',
      name,
      getFile: async () => asDouble<File>({ lastModified: 0 }),
      createWritable: async () => {
        calls.createWritable += 1
        if (fail) {
          fail = false
          throw new Error('disk full')
        }
        return asDouble<FileSystemWritableFileStream>(
          new WritableStream<Uint8Array>({
            close: () => {
              calls.written += 1
            }
          })
        )
      }
    })
    return { handle, calls }
  }

  async function failSaveAs(tab: ReturnType<typeof createTab>, name: string) {
    const picked = pickedHandle(name)
    vi.spyOn(saveTargets, 'chooseBrowserFigSaveHandle').mockResolvedValue(picked.handle)
    await expect(tab.store.saveFigFileAs()).rejects.toThrow()
    return picked
  }

  test('a failed Save As to .fig is what the next save writes', async () => {
    const imported = asDouble<FileSystemFileHandle>({
      kind: 'file',
      name: 'notes.pen',
      getFile: async () => asDouble<File>({ lastModified: 0 })
    })
    const tab = createTab()
    tab.store.setDocumentSource('notes.pen', 'pen', imported)
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    const picked = await failSaveAs(tab, 'copy.fig')
    expect(tab.store.getSourceIdentity().handle?.name).toBe('notes.pen')
    await request('save_document', { document_id: tab.id })
    expect(picked.calls).toEqual({ createWritable: 2, written: 1 })
    expect(tab.store.hasUnsavedChanges()).toBe(false)
  })

  test('a failed Save As to .pen is not written by the next save', async () => {
    const imported = asDouble<FileSystemFileHandle>({
      kind: 'file',
      name: 'notes.fig',
      getFile: async () => asDouble<File>({ lastModified: 0 })
    })
    const tab = createTab()
    tab.store.setDocumentSource('notes.fig', 'fig', imported)
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    const picked = await failSaveAs(tab, 'notes.pen')
    expect(tab.store.getSourceIdentity().handle?.name).toBe('notes.fig')
    await expect(request('save_document', { document_id: tab.id })).rejects.toThrow()
    expect(picked.calls).toEqual({ createWritable: 1, written: 0 })
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })
})
