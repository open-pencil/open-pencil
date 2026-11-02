import { describe, expect, test } from 'bun:test'

import { createEditor } from '@lawha/core'

const VIEWPORT = { width: 800, height: 600 }

function setup() {
  const editor = createEditor({ getViewportSize: () => VIEWPORT })
  const first = editor.state.currentPageId
  const second = editor.graph.addPage('Second').id
  return { editor, first, second }
}

// Figma opens a page the first time with every layer fitted, an empty one with the origin at the
// centre at 100%, and later at the view it was left at.
describe('page viewports', () => {
  test('a first visit fits the page\'s layers with the fit insets', async () => {
    const { editor, second } = setup()
    editor.graph.createNode('RECTANGLE', second, { x: 100, y: 200, width: 300, height: 180 })

    await editor.switchPage(second)

    expect(editor.state.zoom).toBeCloseTo(730 / 300, 6)
    expect(250 * editor.state.zoom + editor.state.panX).toBeCloseTo(45 + 730 / 2, 6)
    expect(290 * editor.state.zoom + editor.state.panY).toBeCloseTo(45 + 470 / 2, 6)
  })

  test('a first visit of an empty page shows the origin at the centre at 100%', async () => {
    const { editor, second } = setup()
    await editor.switchPage(second)
    expect(editor.state).toMatchObject({ panX: 400, panY: 300, zoom: 1 })
  })

  test('a revisit restores the view the page was left at', async () => {
    const { editor, first, second } = setup()
    editor.graph.createNode('RECTANGLE', second, { x: 0, y: 0, width: 100, height: 100 })
    await editor.switchPage(second)
    editor.state.panX = -120
    editor.state.panY = 80
    editor.state.zoom = 0.5

    await editor.switchPage(first)
    await editor.switchPage(second)

    expect(editor.state).toMatchObject({ panX: -120, panY: 80, zoom: 0.5 })
  })

  test('an unmeasured canvas leaves the first visit at the origin, and fits it once measured', async () => {
    let size = { width: 0, height: 0 }
    const editor = createEditor({ getViewportSize: () => size })
    const first = editor.state.currentPageId
    const second = editor.graph.addPage('Second').id
    editor.graph.createNode('RECTANGLE', second, { x: 100, y: 200, width: 300, height: 180 })
    await editor.switchPage(second)
    expect(editor.state).toMatchObject({ panX: 0, panY: 0, zoom: 1 })

    await editor.switchPage(first)
    size = VIEWPORT
    await editor.switchPage(second)
    expect(editor.state.zoom).toBeCloseTo(730 / 300, 6)
  })

  test("keeps a measured page's view when the canvas has no size as it is left", async () => {
    let size = VIEWPORT
    const editor = createEditor({ getViewportSize: () => size })
    const first = editor.state.currentPageId
    const second = editor.graph.addPage('Second').id
    await editor.switchPage(second)
    editor.state.panX = -120
    editor.state.zoom = 0.5

    size = { width: 0, height: 0 }
    await editor.switchPage(first)
    size = VIEWPORT
    await editor.switchPage(second)

    expect(editor.state).toMatchObject({ panX: -120, zoom: 0.5 })
  })

})
