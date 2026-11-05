import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const BOX = { y: 60, width: 40, height: 20 }
const FONT_SIZE = 20
const GLYPH_BOTTOM_EMS = -0.25
const GLYPH_TOP_EMS = 1.25
const COPIES = [
  { x: 40, opacity: 1 },
  { x: 140, opacity: 0.5 }
]

function samePixel(a: readonly number[], b: readonly number[]): boolean {
  return a.every((channel, index) => channel === b[index])
}

test('a trimmed text drawn from its saved glyphs keeps them past its box at half opacity', async () => {
  await editor.page.evaluate(
    async ({ box, fontSize, bottom, top, copies }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const corners = [
        [0, bottom],
        [1, bottom],
        [1, top],
        [0, top]
      ]
      const commandsBlob = new Uint8Array(corners.length * 9 + 1)
      const view = new DataView(commandsBlob.buffer)
      for (const [index, [x, y]] of corners.entries()) {
        commandsBlob[index * 9] = index === 0 ? 1 : 2
        view.setFloat32(index * 9 + 1, x, true)
        view.setFloat32(index * 9 + 5, y, true)
      }
      const solid = (value: number) => ({
        type: 'SOLID' as const,
        color: { r: value, g: value, b: value, a: 1 },
        visible: true,
        opacity: 1
      })
      store.graph.createNode('FRAME', store.state.currentPageId, {
        name: 'Card',
        width: 240,
        height: 140,
        fills: [solid(1)]
      })
      const texts = copies.map((copy) =>
        store.graph.createNode('TEXT', store.state.currentPageId, {
          name: `Saved ${copy.opacity}`,
          text: 'A',
          x: copy.x,
          ...box,
          fontSize,
          fontFamily: 'Saved Glyphs Only',
          leadingTrim: 'CAP_HEIGHT',
          textAutoResize: 'WIDTH_AND_HEIGHT',
          derivedTextHeight: null,
          opacity: copy.opacity,
          fills: [solid(0)],
          derivedTextGlyphs: [{ commandsBlob, x: 0, y: box.height, fontSize, firstCharacter: 0 }]
        })
      )
      await store.loadFontsForNodes(texts.map((text) => text.id))
      store.clearSelection()
      store.requestRender()
    },
    { box: BOX, fontSize: FONT_SIZE, bottom: GLYPH_BOTTOM_EMS, top: GLYPH_TOP_EMS, copies: COPIES }
  )
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const rows = [BOX.y - 3, BOX.y + BOX.height / 2, BOX.y + BOX.height + 3]
  for (const copy of COPIES) {
    const keepsInkPastBox = async () => {
      const [above, inside, below] = await readScenePixels(
        editor.page,
        rows.map((y) => ({ x: copy.x + FONT_SIZE / 2, y }))
      )
      const inked = inside.some((channel) => channel !== 255)
      return inked && samePixel(above, inside) && samePixel(below, inside)
    }
    // A first frame may be drawn before the text settles; the settled frame must keep the ink.
    await expect.poll(keepsInkPastBox).toBe(true)
  }
})
