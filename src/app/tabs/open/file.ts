import { filename } from 'pathe/utils'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { nextFrame } from '@open-pencil/vue/shared/frame'

import { documentAssetReader } from '@/app/document/io/assets'
import { readFigDocument } from '@/app/document/io/fig'
import { isFigArchiveName } from '@/app/document/io/names'
import type { DocumentSourceIdentity } from '@/app/document/io/types'
import { appIcons } from '@/app/editor/icons/provider'
import type { EditorStore } from '@/app/editor/session'
import { createDeferred } from '@/app/runtime/deferred'
import { createFileOpenCoordinator } from '@/app/tabs/open/coordinator'
import { refreshOpenedFigCover, watchOpenedFigCover } from '@/app/tabs/open/cover'
import { findTabByFileIdentity } from '@/app/tabs/open/identity'
import {
  failPreparation,
  releaseOpeningTab,
  reusableTabStore,
  showImportedGraph
} from '@/app/tabs/open/show'
import { getTabForStore, getTabsSnapshot, switchTab } from '@/app/tabs/state'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const fileOpenCoordinator = createFileOpenCoordinator()

function isDOMImportFile(file: File): boolean {
  return /\.(html?|xhtml)$/i.test(file.name)
}
/**
 * Opens a file in a tab, or shows the tab that already has it or is opening it. An HTML file is
 * imported as a DOM document; any other is read as the format its name says.
 */
export async function openFileInNewTab(
  file: File,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<EditorStore> {
  const identity: DocumentSourceIdentity = {
    handle: handle ?? null,
    path: path ?? null
  }
  const decision = await fileOpenCoordinator.decide(async () => {
    const pending = await fileOpenCoordinator.findPending(identity)
    if (pending) {
      const tab = getTabForStore(pending.store)
      if (tab) switchTab(tab.id)
      return { kind: 'pending' as const, completion: pending.completion, store: pending.store }
    }

    const existing = await findTabByFileIdentity(getTabsSnapshot(), identity)
    if (existing) {
      switchTab(existing.id)
      if (path && isFigArchiveName(path)) {
        watchOpenedFigCover(path, existing.store)
        refreshOpenedFigCover(path, existing.store)
      }
      return { kind: 'existing' as const, store: existing.store }
    }

    const opening = reusableTabStore()
    const { store } = opening
    store.state.documentName = filename(file.name) ?? file.name
    const load = store.preparationController.begin({
      kind: isDOMImportFile(file) ? 'dom-import' : 'document-open',
      subject: file.name
    })

    const completion = createDeferred<undefined>()
    void completion.promise.catch(() => undefined)
    const pendingOpen = { completion: completion.promise, identity, store }
    fileOpenCoordinator.add(pendingOpen)
    return { kind: 'owner' as const, completion, pendingOpen, store, opening, load }
  })

  if (decision.kind === 'existing') return decision.store
  if (decision.kind === 'pending') {
    await decision.completion
    return decision.store
  }

  const { completion, pendingOpen, store, opening, load } = decision
  let succeeded = false
  try {
    if (isDOMImportFile(file)) {
      await store.openDOMFile(file, { handle, path, preparation: load })
      completion.resolve(undefined)
      succeeded = true
      return store
    }

    await nextFrame()
    load.update({ phase: 'reading', detail: file.name })
    const isFig = isFigArchiveName(file.name)
    let imported: SceneGraph
    let sourceFormat: string
    if (isFig) {
      load.update({ phase: 'decoding', detail: file.name })
      imported = await readFigDocument(file, load.signal)
      sourceFormat = 'fig'
    } else {
      const result = await io.readDocument(
        {
          name: file.name,
          mimeType: file.type || undefined,
          data: new Uint8Array(await file.arrayBuffer()),
          readAsset: documentAssetReader(path)
        },
        { icons: appIcons }
      )
      imported = result.graph
      sourceFormat = result.sourceFormat
    }

    await showImportedGraph(
      store,
      imported,
      () => {
        store.setDocumentSource(file.name, sourceFormat, handle, path)
        if (isFig && path) watchOpenedFigCover(path, store)
      },
      load
    )
    if (isFig && path) refreshOpenedFigCover(path, store)
    completion.resolve(undefined)
    succeeded = true
    return store
  } catch (error) {
    failPreparation(load, 'decode-failed', error)
    completion.reject(error)
    await releaseOpeningTab(opening)
    throw error
  } finally {
    if (succeeded) load.complete()
    fileOpenCoordinator.remove(pendingOpen)
  }
}
