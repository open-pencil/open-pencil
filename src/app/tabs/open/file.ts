import { filename } from 'pathe/utils'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import type { DesignViewport } from '@open-pencil/dom-css'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { createDeferred } from '@open-pencil/std/async'
import { nextFrame } from '@open-pencil/vue/shared/frame'

import { documentAssetReader } from '@/app/document/io/assets'
import { readFigDocument } from '@/app/document/io/fig'
import { isFigArchiveName } from '@/app/document/io/names'
import type { DocumentSourceIdentity } from '@/app/document/io/types'
import { appIcons } from '@/app/editor/icons/provider'
import type { EditorStore } from '@/app/editor/session'
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

/** A page fetched from the web: the address it came from and what its document is called. */
export interface OpenedWebPage {
  url: string
  title: string
  /** The window the page is laid out in; a desktop browser's when not given. */
  viewport?: DesignViewport
  /** Renders the page in the desktop app first, so its scripts build it. */
  render?: boolean
}

export interface OpenInTabOptions {
  /** The file the browser granted, which saving writes back to. */
  handle?: FileSystemFileHandle
  /** Where the file lives: a desktop path, or the address a browser document came from. */
  path?: string
  /**
   * Opens the file as this web page: as HTML, whatever its name, its stylesheets and pictures
   * read from where it lives, and its document called by the page's title.
   */
  webPage?: OpenedWebPage
  /** Cancels the open, as the user cancelling it does: the tab it was opening closes. */
  signal?: AbortSignal
}

/**
 * Opens a file in a tab, or shows the tab that already has it or is opening it. An HTML file or
 * a web page is imported as a DOM document; any other is read as the format its name says.
 */
export async function openFileInNewTab(
  file: File,
  { handle, path, webPage, signal }: OpenInTabOptions = {}
): Promise<EditorStore> {
  const domImport = webPage !== undefined || isDOMImportFile(file)
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
    store.state.documentName = webPage?.title ?? filename(file.name) ?? file.name
    const load = store.preparationController.begin({
      kind: domImport ? 'dom-import' : 'document-open',
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
  const cancel = () => load.cancel('user')
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    if (signal?.aborted) cancel()
    load.signal.throwIfAborted()
    if (domImport) {
      await store.openDOMFile(file, { handle, path, webPage, preparation: load })
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
    signal?.removeEventListener('abort', cancel)
    if (succeeded) load.complete()
    fileOpenCoordinator.remove(pendingOpen)
  }
}
