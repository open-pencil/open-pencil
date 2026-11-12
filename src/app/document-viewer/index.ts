import { onScopeDispose, provide, ref, shallowRef } from 'vue'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import type { SceneNode } from '@open-pencil/scene-graph'

// The app's module that points Core at the files the openPencil() Vite plugin serves.
import '@/app/editor/canvas/canvaskit'
import { COLLAB_KEY, useCollab } from '@/app/collab/use'
import { provideTabEditorStore } from '@/app/editor/active-store'
import { registerInterfaceFont } from '@/app/editor/fonts/interface'
import { closeTab, createTab } from '@/app/tabs'

let engine: Promise<void> | null = null

/** Loads CanvasKit and the interface font once; a failed download is tried again next time. */
function prepareEngine(): Promise<void> {
  if (engine) return engine
  const request = (async () => {
    registerInterfaceFont()
    await getCanvasKit()
  })()
  request.catch(() => {
    if (engine === request) engine = null
  })
  engine = request
  return request
}

/**
 * A `.fig` from `url`, open read-only in an editor of its own: the engine loads when first asked,
 * and the editor and its tab go when the component that called this unmounts. Nothing done in it
 * reaches the file. Pages that otherwise never load the editor reach this only lazily, such as
 * the team dashboard for a report's attached document.
 */
export function useReadOnlyDocument(url: string, name: string) {
  const tab = createTab()
  const store = tab.store
  store.state.showRulers = false
  provideTabEditorStore(store)
  provide(COLLAB_KEY, useCollab())

  const status = ref<'loading' | 'ready' | 'failed'>('loading')
  const pages = shallowRef<SceneNode[]>([])
  // Closing the viewer stops a download still on its way, and nothing opens in the closed tab.
  const disposal = new AbortController()

  async function open(): Promise<void> {
    try {
      const [response] = await Promise.all([
        fetch(url, { signal: disposal.signal }),
        prepareEngine()
      ])
      if (!response.ok) throw new Error(`The document answered ${response.status}`)
      const bytes = await response.arrayBuffer()
      disposal.signal.throwIfAborted()
      await store.openFigFile(new File([bytes], name))
      disposal.signal.throwIfAborted()
      store.setReadOnly(true)
      pages.value = store.graph.getPages()
      status.value = 'ready'
    } catch (error) {
      if (disposal.signal.aborted) return
      console.warn('The document could not open', error)
      status.value = 'failed'
    }
  }

  onScopeDispose(() => {
    disposal.abort()
    closeTab(tab.id, 'discard').catch((error: unknown) => {
      console.warn('The document viewer could not close its tab', error)
    })
  })

  return { store, status, pages, open, engineReady: prepareEngine }
}
