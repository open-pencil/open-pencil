import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('saved text strokes keep to their side of the glyphs', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const FONT_SIZE = 60
    const WEIGHT = 3
    type Command = [number, ...number[]]
    type Box = { left: number; top: number; right: number; bottom: number }

    const blob = (commands: Command[]) => {
      const view = new DataView(new ArrayBuffer(4))
      return new Uint8Array(
        commands.flatMap(([op, ...args]) => [
          op,
          ...args.flatMap((value) => {
            view.setFloat32(0, value, true)
            return [view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)]
          })
        ])
      )
    }
    const contour = ({ left, top, right, bottom }: Box, reversed = false): Command[] =>
      reversed
        ? [[1, left, top], [2, left, bottom], [2, right, bottom], [2, right, top], [0]]
        : [[1, left, top], [2, right, top], [2, right, bottom], [2, left, bottom], [0]]
    const grow = (box: Box, by: number): Box => ({
      left: box.left - by,
      top: box.top - by,
      right: box.right + by,
      bottom: box.bottom + by
    })
    const band = (box: Box) => [...contour(grow(box, WEIGHT)), ...contour(grow(box, -WEIGHT), true)]

    const block = { left: 0, top: 0, right: 0.5, bottom: 0.7 }
    const ring = { left: 0, top: 0, right: 0.6, bottom: 0.7 }
    const counter = { left: 0.15, top: 0.15, right: 0.45, bottom: 0.55 }
    const glyphs = [
      { x: 6, commands: [...contour(block)], boxes: [block] },
      { x: 48, commands: [...contour(ring), ...contour(counter, true)], boxes: [ring, counter] }
    ]
    const toLayer = (box: Box, x: number, baseline: number): Box => ({
      left: x + box.left * FONT_SIZE,
      right: x + box.right * FONT_SIZE,
      top: baseline - box.bottom * FONT_SIZE,
      bottom: baseline - box.top * FONT_SIZE
    })

    const pageId = store.state.currentPageId
    store.graph.createNode('RECTANGLE', pageId, {
      x: 20,
      y: 20,
      width: 520,
      height: 140,
      fills: [
        { type: 'SOLID', color: { r: 0.46, g: 0.49, b: 0.53, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const cases = [
      { align: 'OUTSIDE', baseline: 64 },
      { align: 'INSIDE', baseline: 64 },
      { align: 'CENTER', baseline: 64 },
      { align: 'OUTSIDE', baseline: 64.4 }
    ] as const
    for (const [index, { align, baseline }] of cases.entries()) {
      store.graph.createNode('TEXT', pageId, {
        x: 40 + index * 125,
        y: 50,
        width: 110,
        height: 80,
        text: 'IO',
        fontFamily: 'Unavailable Visual Test Face',
        fontSize: FONT_SIZE,
        fills: [
          { type: 'SOLID', color: { r: 1, g: 0.83, b: 0.23, a: 1 }, opacity: 1, visible: true }
        ],
        derivedTextGlyphs: glyphs.map((glyph, character) => ({
          commandsBlob: blob(glyph.commands),
          x: glyph.x,
          y: baseline,
          fontSize: FONT_SIZE,
          firstCharacter: character
        })),
        strokeWeight: WEIGHT,
        strokes: [
          {
            type: 'SOLID',
            color: { r: 0.08, g: 0.08, b: 0.1, a: 1 },
            opacity: 1,
            visible: true,
            weight: WEIGHT,
            align
          }
        ],
        strokeGeometry: [
          {
            windingRule: 'NONZERO',
            commandsBlob: blob(
              glyphs.flatMap((glyph) =>
                glyph.boxes.flatMap((box) => band(toLayer(box, glyph.x, baseline)))
              )
            )
          }
        ]
      })
    }
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot('saved-text-stroke-sides.png')
})
