import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

test('a page switch overtaken by another resolves instead of rejecting', async () => {
  const store = createEditorStore()
  // Stand in for the canvas, which acknowledges each scene it presents.
  store.onPreparationEvent('preparation:updated', (preparation) => {
    if (preparation.phase === 'preparing-render')
      store.preparationController.acknowledgePresentation(store.state.sceneVersion)
  })
  const b = store.graph.addPage('B').id
  const c = store.graph.addPage('C').id

  const first = store.switchPage(b)
  const second = store.switchPage(c)

  await expect(first).resolves.toBeUndefined()
  await second
  expect(store.state.currentPageId).toBe(c)
})
