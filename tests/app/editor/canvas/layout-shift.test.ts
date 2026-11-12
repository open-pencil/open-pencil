import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import { keepDrawingStillAsCanvasMoves } from '@/app/editor/canvas/layout-shift'
import { createEditorStore } from '@/app/editor/session/create'
import { follow, presenceOf, setPeers } from '@/app/presence/registry'

const PANEL_WIDTH = 230

const stores: ReturnType<typeof createEditorStore>[] = []
afterEach(() => {
  for (const store of stores.splice(0)) {
    store.dispose()
  }
})

function setup() {
  const store = createEditorStore()
  stores.push(store)
  Object.assign(store.state, { panX: 40, panY: 30 })
  return store
}

function splitIntoTwoPanes(store: ReturnType<typeof createEditorStore>) {
  const first = store.activePaneId.value
  const second = store.splitPane(first, 'horizontal')
  if (!second) {
    throw new Error('split failed')
  }
  store.setActivePane(first)
  return { active: first, inactive: second.id }
}

describe('keeping the drawing still as the canvas moves', () => {
  test('pans the active view the other way', () => {
    const store = setup()
    keepDrawingStillAsCanvasMoves(store, undefined, -PANEL_WIDTH, 0)

    expect(store.state).toMatchObject({ panX: 40 + PANEL_WIDTH, panY: 30 })
  })

  test('keeps following a person through the shift', () => {
    const store = setup()
    const ana = { clientId: 4, name: 'Ana', color: { r: 1, g: 0, b: 0, a: 1 }, agents: [] }
    setPeers(store, [{ ...ana, cursor: { x: 40, y: 50, pageId: store.state.currentPageId } }])
    follow(store, { kind: 'person', clientId: 4 })

    keepDrawingStillAsCanvasMoves(store, undefined, -PANEL_WIDTH, 0)
    expect(presenceOf(store).following.value).toEqual({ kind: 'person', clientId: 4 })

    store.pan(10, 0)
    expect(presenceOf(store).following.value).toBeNull()
  })

  test('an inactive split pane shifts its own view and leaves the active one', () => {
    const store = setup()
    const { inactive } = splitIntoTwoPanes(store)
    const activeBefore = { panX: store.state.panX, panY: store.state.panY }
    const inactiveView = store.getPaneView(inactive)
    if (!inactiveView) {
      throw new Error('inactive pane has no view')
    }
    const inactiveBefore = { panX: inactiveView.panX, panY: inactiveView.panY }

    keepDrawingStillAsCanvasMoves(store, inactive, -PANEL_WIDTH, 12)

    expect(store.getPaneView(inactive)).toMatchObject({
      panX: inactiveBefore.panX + PANEL_WIDTH,
      panY: inactiveBefore.panY - 12
    })
    expect(store.state).toMatchObject(activeBefore)
  })

  test('a pane that just closed moves no view', () => {
    const store = setup()
    const { inactive } = splitIntoTwoPanes(store)
    store.closePane(inactive)
    const before = { panX: store.state.panX, panY: store.state.panY }

    keepDrawingStillAsCanvasMoves(store, inactive, -PANEL_WIDTH, 0)

    expect(store.state).toMatchObject(before)
  })
})
