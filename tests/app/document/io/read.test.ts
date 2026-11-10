import { afterEach, describe, expect, test, vi } from 'bun:test'

import type { Editor } from '@open-pencil/core'
import * as fig from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'
import { asDouble } from '@open-pencil/test-support/doubles'

import * as importedDocument from '@/app/document/io/imported-document'
import { createReloadActions } from '@/app/document/io/read'
import * as reloadSource from '@/app/document/io/reload-source'
import * as reloadState from '@/app/document/io/reload-state'
import type { EditorPreparationController } from '@/app/editor/preparation/controller'
import { toast } from '@/app/shell/ui'

function reloadHarness(
  unsaved: boolean,
  source: { path: string | null } = { path: null },
  markDocumentSaved: () => void = vi.fn()
) {
  const begin = vi.fn(() => ({
    id: 1,
    signal: new AbortController().signal,
    update: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    cancel: vi.fn()
  }))
  const getFilePath = vi.fn(() => source.path)
  const actions = createReloadActions({
    editor: asDouble<Editor>({ graph: {} }),
    state: asDouble({ documentName: 'Design', panX: 0, panY: 0, zoom: 1, currentPageId: '0:1' }),
    getFilePath,
    getFileHandle: () => null,
    hasUnsavedChanges: () => unsaved,
    markDocumentSaved,
    preparationController: asDouble<EditorPreparationController>({ begin })
  })
  return { actions, begin, getFilePath }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const entry of toast.toasts.value) toast.remove(entry.id)
})

describe('reloading a document that changed on disk', () => {
  test('stops the open document’s reader worker before reading the file again', async () => {
    const stop = vi.spyOn(fig, 'stopFigReaderWorker').mockReturnValue(undefined)
    const { actions, begin, getFilePath } = reloadHarness(false)

    await actions.reloadFromDisk()

    expect(stop).toHaveBeenCalledTimes(1)
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(getFilePath.mock.invocationCallOrder[0])
    expect(begin).toHaveBeenCalledTimes(1)
  })

  test('marks the file saved before the page it showed loads, so an edit meanwhile stays unsaved', async () => {
    vi.spyOn(fig, 'stopFigReaderWorker').mockReturnValue(undefined)
    vi.spyOn(reloadSource, 'readReloadSource').mockResolvedValue(new SceneGraph())
    vi.spyOn(importedDocument, 'applyImportedDocument').mockResolvedValue(undefined)
    const calls: string[] = []
    vi.spyOn(reloadState, 'restoreReloadState').mockImplementation(async () => {
      calls.push('restore')
    })
    const markDocumentSaved = vi.fn(() => calls.push('saved'))
    const { actions } = reloadHarness(false, { path: '/designs/design.fig' }, markDocumentSaved)

    await actions.reloadFromDisk()

    expect(calls).toEqual(['saved', 'restore'])
  })

  test('keeps unsaved edits and offers to reload, which discards them', async () => {
    const stop = vi.spyOn(fig, 'stopFigReaderWorker').mockReturnValue(undefined)
    const { actions, begin } = reloadHarness(true)

    await actions.reloadFromDisk()

    expect(begin).not.toHaveBeenCalled()
    expect(stop).not.toHaveBeenCalled()
    const [offer] = toast.toasts.value
    expect(offer).toMatchObject({ variant: 'warning', sticky: true })
    expect(offer?.message).toContain('Design')
    offer?.action?.run(offer.id)
    await Bun.sleep(0)
    expect(begin).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(toast.toasts.value).toHaveLength(0)
  })

  test('drops an offer for a file the document has since left', async () => {
    vi.spyOn(fig, 'stopFigReaderWorker').mockReturnValue(undefined)
    const source = { path: '/designs/original.fig' as string | null }
    const { actions, begin } = reloadHarness(true, source)

    await actions.reloadFromDisk()
    source.path = '/designs/copy.fig'
    const [offer] = toast.toasts.value
    offer?.action?.run(offer.id)
    await Bun.sleep(0)

    expect(begin).not.toHaveBeenCalled()
    expect(toast.toasts.value).toHaveLength(0)
  })
})
