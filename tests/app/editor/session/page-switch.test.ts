import 'fake-indexeddb/auto'
import { afterEach, expect, spyOn, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditorStore } from '@/app/editor/session/create'
import { toast } from '@/app/shell/ui'
import { showImportedGraph } from '@/app/tabs/open/show'

afterEach(() => {
  toast.toasts.value = []
})

test('a page switch overtaken by another resolves instead of rejecting', async () => {
  const store = createEditorStore()
  // Stand in for the canvas, which acknowledges each scene it presents.
  store.onPreparationEvent('preparation:updated', (preparation) => {
    if (preparation.phase === 'preparing-render')
      store.preparationController.acknowledgePresentation(store.state)
  })
  const b = store.graph.addPage('B').id
  const c = store.graph.addPage('C').id

  const first = store.switchPage(b)
  const second = store.switchPage(c)

  await expect(first).resolves.toBeUndefined()
  await second
  expect(store.state.currentPageId).toBe(c)
})

test('a page that cannot be shown stays in and fails its preparation as a render', async () => {
  const store = createEditorStore()
  const failures: string[] = []
  store.onPreparationEvent('preparation:failed', (failure) => failures.push(failure.code))
  // No canvas can present the scene, as when the only one stopped drawing it.
  store.preparationController.failCanvas(new Error('canvas stalled'))
  const b = store.graph.addPage('B').id
  const load = store.preparationController.begin({ kind: 'document-open', subject: 'b.fig' })

  await expect(store.switchPage(b, { preparation: load })).resolves.toBeUndefined()

  expect(store.state.currentPageId).toBe(b)
  expect(failures).toEqual(['render-failed'])
  expect(store.state.preparation).toBeNull()
  expect(toast.toasts.value.map((entry) => entry.variant)).toEqual(['error'])
})

test.each([
  ['keeps a display failure', false],
  ['accepts an AbortError reported by the interrupted work', true]
] as const)('a page switch taking over an open %s', async (_label, aborted) => {
  const store = createEditorStore()
  const graph = new SceneGraph()
  const page = graph.addPage('Next')
  const fitting = Promise.withResolvers<undefined>()
  const started = Promise.withResolvers<undefined>()
  const fit = spyOn(store, 'fitCurrentPageToViewport').mockImplementationOnce(() => {
    started.resolve(undefined)
    return fitting.promise
  })
  const load = store.preparationController.begin({ kind: 'document-open' })
  store.onPreparationEvent('preparation:updated', (preparation) => {
    if (preparation.kind === 'page-switch' && preparation.phase === 'preparing-render') {
      store.preparationController.acknowledgePresentation(store.state)
    }
  })
  const showing = showImportedGraph(store, graph, undefined, load).catch((error: unknown) => error)

  try {
    await started.promise
    const failure = aborted
      ? new DOMException('Aborted', 'AbortError')
      : new Error('Could not fit the viewport')
    fitting.reject(failure)
    const next = store.switchPage(page.id)
    expect(await showing).toBe(aborted ? undefined : failure)
    await next
  } finally {
    fit.mockRestore()
    store.dispose()
  }
})
