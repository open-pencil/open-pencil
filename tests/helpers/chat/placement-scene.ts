import type { Page } from '@playwright/test'

import type { RenderPlacementInput } from '@open-pencil/core/design-jsx'
import type { Color, Fill } from '@open-pencil/scene-graph'

export type PlacementScenario =
  | 'nested-fill'
  | 'nested-hug'
  | 'nested-replace'
  | 'top-level-replace'
  | 'page-insertion'
  | 'rotated-clip'

export function setupPlacementScene(page: Page, scenario: PlacementScenario) {
  return page.evaluate((scenario) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const pageId = store.state.currentPageId
    const solid = (color: Color): Fill => ({ type: 'SOLID', color, opacity: 1, visible: true })
    const hug = scenario === 'nested-hug'
    const board = store.graph.createNode('FRAME', pageId, {
      name: 'Board',
      x: 60,
      y: 70,
      width: 420,
      height: 260,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: hug ? 'HUG' : 'FIXED',
      counterAxisSizing: hug ? 'HUG' : 'FIXED',
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20,
      cornerRadius: 16,
      rotation: scenario === 'rotated-clip' ? 12 : 0,
      clipsContent: scenario === 'rotated-clip',
      fills: [solid({ r: 0.12, g: 0.14, b: 0.2, a: 1 })]
    })
    const row = store.graph.createNode('FRAME', board.id, {
      name: 'Row',
      width: 380,
      height: 160,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: hug ? 'HUG' : 'FIXED',
      counterAxisSizing: hug ? 'HUG' : 'FIXED',
      layoutAlignSelf: hug ? 'AUTO' : 'STRETCH',
      itemSpacing: 12,
      paddingTop: 12,
      paddingRight: 12,
      paddingBottom: 12,
      paddingLeft: 12,
      fills: [solid({ r: 0.85, g: 0.87, b: 0.92, a: 1 })]
    })
    const left = store.graph.createNode('RECTANGLE', row.id, {
      name: 'Left',
      width: 44,
      height: 56,
      fills: [solid({ r: 0.93, g: 0.3, b: 0.3, a: 1 })]
    })
    store.graph.createNode('RECTANGLE', row.id, {
      name: 'Right',
      width: 66,
      height: 84,
      fills: [solid({ r: 0.2, g: 0.45, b: 0.94, a: 1 })]
    })
    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Foreground sibling',
      x: 230,
      y: 150,
      width: 100,
      height: 110,
      cornerRadius: 10,
      fills: [solid({ r: 0.1, g: 0.75, b: 0.6, a: 1 })]
    })
    store.runLayoutForNode(board.id)
    store.requestRender()
    let placement: RenderPlacementInput = { parent_id: row.id, insert_index: 1 }
    let jsx = '<Frame name="Inserted" w="fill" h="fill" bg="#9747ff" rounded={8}/>'
    if (scenario === 'nested-hug')
      jsx = '<Rect name="Inserted" w={140} h={100} bg="#9747ff" rounded={8}/>'
    if (scenario === 'nested-replace') placement = { replace_id: left.id }
    if (scenario === 'top-level-replace') {
      placement = { replace_id: board.id }
      jsx = '<Frame name="Replacement" x={999} y={888} w={220} h={140} bg="#9747ff" rounded={16}/>'
    }
    if (scenario === 'page-insertion') {
      placement = { insert_index: 0, x: 20, y: 20 }
      jsx = '<Rect name="Behind board" w={220} h={140} bg="#ff9900" rounded={8}/>'
    }
    if (scenario === 'rotated-clip') jsx = '<Rect name="Overflowing" w={400} h={240} bg="#9747ff"/>'
    return { placement, jsx }
  }, scenario)
}
