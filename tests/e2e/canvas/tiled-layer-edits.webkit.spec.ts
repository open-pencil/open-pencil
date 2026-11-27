import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { tiledEditsDriver } from '#tests/helpers/canvas/tiled-edits/driver'

test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })

test.describe('edits inside a frame of a few layers', () => {
  test('redraw only the tiles around the layer, and leave nothing stale', async ({ page }) => {
    await page.goto('/?test&no-rulers')
    await new CanvasHelper(page).waitForInit()
    const scene = tiledEditsDriver(() => page)
    const { text, square } = await scene.show()

    const startEditing = await scene.tilesRenderedBy(() => scene.startEditing(text))
    const typing = await scene.tilesRenderedBy(() =>
      scene.type(' and type a line long enough to wrap')
    )
    await scene.stopEditing()
    // Into another tile, so where it went is not where it was.
    const moving = await scene.tilesRenderedBy(() => scene.moveBy(square, 760, 420))
    const recolouring = await scene.tilesRenderedBy(() => scene.recolour(square))
    const undoing = await scene.tilesRenderedBy(() => scene.undo())
    await scene.undo()

    const { tiled, redrawn } = await scene.tiledAndRedrawn()
    expect(tiled.equals(redrawn)).toBe(true)
    // Tiles are 512 px squares of the page; the frame spans four of those in view.
    expect({ startEditing, moving, recolouring, undoing }).toEqual({
      startEditing: 1,
      moving: 2,
      recolouring: 1,
      undoing: 1
    })
    expect(typing).toBeGreaterThan(0)
  })
})
