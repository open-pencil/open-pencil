import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

/**
 * Path text is laid out from the shaped glyphs of its font when its text changes: kerned pairs,
 * ligatures, and marks placed on their base letters.
 */
test('reflows text on a path with its kerning, ligatures, and marks', async () => {
  const reflowed = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const box = { x: 40, y: 40, width: 400, height: 100 }
    const node = store.graph.createNode('TEXT', store.state.currentPageId, {
      ...box,
      text: 'AB',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      fontSize: 40,
      textAutoResize: 'NONE',
      textPathBox: { ...box },
      // Where the old text sat on the path, which the new text is laid out from.
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 50, y: 50, fontSize: 40, rotation: 0 },
        { commandsBlob: new Uint8Array(4), x: 90, y: 50, fontSize: 40, rotation: 0 }
      ]
    })
    node.textPathData = {
      network: {
        vertices: [
          { x: 0, y: 50 },
          { x: 400, y: 50 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      },
      normalizedSize: { x: 400, y: 100 },
      tValue: 0,
      forward: true
    }
    store.updateNode(node.id, { text: 'AVATAR office q́ x̣' })
    store.requestRender()
    return store.graph.getNode(node.id)?.derivedTextGlyphs?.length ?? 0
  })
  expect(reflowed).toBeGreaterThan(0)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()

  // A misplaced mark moves a few hundred pixels, which the default 1% of the region would allow.
  expect(await editor.canvas.screenshotCanvasRegion(480, 180)).toMatchSnapshot(
    'text-path-reflowed-shaping.png',
    { maxDiffPixels: 50 }
  )
})
