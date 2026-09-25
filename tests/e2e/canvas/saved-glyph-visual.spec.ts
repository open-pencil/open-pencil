import type { Fill, StyleRun } from '@open-pencil/scene-graph'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import styledGlyphs from '#tests/fixtures/styled-saved-glyphs.json' with { type: 'json' }

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('saved glyphs remain authoritative with an available font and invalidate on edit', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const bytes = new Uint8Array(37)
    const view = new DataView(bytes.buffer)
    for (const [index, [command, x, y]] of [
      [1, 0, 0],
      [2, 1, 0],
      [2, 1, 1],
      [2, 0, 1]
    ].entries()) {
      bytes[index * 9] = command
      view.setFloat32(index * 9 + 1, x, true)
      view.setFloat32(index * 9 + 5, y, true)
    }
    for (const [index, action] of ['unchanged', 'paint', 'text', 'width', 'runs'].entries()) {
      const node = store.graph.createNode('TEXT', store.state.currentPageId, {
        x: 40 + index * 150,
        y: 100,
        width: 140,
        height: 60,
        text: 'Inter',
        fontFamily: 'Inter',
        fontSize: 32,
        fills: [
          { type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.8, a: 1 }, opacity: 1, visible: true }
        ],
        derivedTextGlyphs: [{ commandsBlob: bytes.slice(), x: 4, y: 40, fontSize: 32 }]
      })
      if (action === 'paint')
        store.graph.updateNode(node.id, {
          fills: [
            { type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.1, a: 1 }, opacity: 1, visible: true }
          ]
        })
      if (action === 'runs') {
        store.graph.updateNode(node.id, {
          styleRuns: [
            {
              start: 0,
              length: 2,
              style: {
                fills: [
                  {
                    type: 'SOLID',
                    color: { r: 0.1, g: 0.7, b: 0.2, a: 1 },
                    opacity: 1,
                    visible: true
                  }
                ]
              }
            }
          ],
          derivedTextGlyphs: [
            { commandsBlob: bytes.slice(), x: 4, y: 40, fontSize: 24, firstCharacter: 0 },
            { commandsBlob: bytes.slice(), x: 40, y: 40, fontSize: 24, firstCharacter: 2 }
          ]
        })
      }
      if (action === 'text') store.graph.updateNode(node.id, { text: 'Edited' })
      if (action === 'width') store.graph.updateNode(node.id, { width: 100 })
    }
    store.requestRender()
  })
  await editor.page.evaluate((fixture) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    store.graph.createNode('TEXT', store.state.currentPageId, {
      ...fixture,
      x: 40,
      y: 220,
      fills: fixture.fills as Fill[],
      styleRuns: fixture.styleRuns as StyleRun[],
      derivedTextGlyphs: fixture.derivedTextGlyphs.map((glyph) => ({
        ...glyph,
        commandsBlob: new Uint8Array(glyph.commandsBlob)
      }))
    })
    store.requestRender()
  }, styledGlyphs)
  await editor.page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return (
      store?.graph.getChildren(store.state.currentPageId).filter((node) => node.type === 'TEXT')
        .length === 6
    )
  })
  await editor.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('saved-glyph-authority.png')
})
