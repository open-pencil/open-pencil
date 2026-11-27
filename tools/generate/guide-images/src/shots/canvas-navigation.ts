import type { Page } from '@playwright/test'

import { boxOf, buildScene, layerBox, selectLayer, settle, within } from '../app.ts'
import type { Picture } from '../compose.ts'
import { SCENE_RADIUS, playlist, tags } from '../scenes.ts'
import { menuPicture, picture, type Shot } from './shared.ts'

const MEASURE_ZOOM = 1.2
/** Where the guide lands, in document pixels from the top of the page. */
const GUIDE_Y = 52
const GUIDE_ZOOM = 0.9

async function zoomMenu(page: Page): Promise<Picture> {
  await buildScene(page, playlist())
  await page.getByTestId('zoom-dropdown-trigger').click()
  await settle(page)
  return menuPicture(page)
}

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  zoom: { take: zoomMenu },
  'zoom-other': { keyboard: 'other', take: zoomMenu },
  measure: {
    async take(page) {
      await buildScene(page, playlist(), MEASURE_ZOOM)
      // The row below its neighbour, so the distance stays clear of the size under it.
      await selectLayer(page, ['Playlist', 'Low Tide'])
      // The overlay follows the pointer, so it moves there from the canvas with the key down.
      await page.mouse.move(700, 120)
      await page.keyboard.down('Alt')
      const target = within(await layerBox(page, ['Playlist', 'Paper Lanterns']), 0.5, 0.5)
      await page.mouse.move(target.x, target.y, { steps: 8 })
      await settle(page)
      const shot = await picture(
        page,
        await layerBox(page, ['Playlist']),
        SCENE_RADIUS * MEASURE_ZOOM
      )
      await page.keyboard.up('Alt')
      return shot
    }
  },
  guide: {
    // A short window, so the cards sit near the ruler.
    window: { width: 1280, height: 520 },
    async take(page) {
      await buildScene(page, playlist(), GUIDE_ZOOM)
      await page.evaluate(
        async ({ jsx, zoom }) => {
          await window.openPencil?.test?.automation?.('tool', {
            name: 'render',
            args: { jsx, x: 340, y: 0 }
          })
          const store = window.openPencil?.getStore?.()
          store?.clearSelection()
          store?.centerOn(320, 96, zoom)
        },
        { jsx: tags(), zoom: GUIDE_ZOOM }
      )
      await settle(page)
      const area = await boxOf(page.getByTestId('canvas-area'))
      const card = await layerBox(page, ['Playlist'])
      const other = await layerBox(page, ['Tags'])
      // Over the page, between the cards, so it is a page guide.
      const x = (card.x + card.width + other.x) / 2
      const y = card.y + GUIDE_Y * GUIDE_ZOOM
      await page.mouse.move(x, area.y + 8)
      await page.mouse.down()
      await page.mouse.move(x, y, { steps: 12 })
      await page.mouse.up()
      // Dragging lands between whole pixels; the picture shows a round position.
      await page.evaluate((position) => {
        const store = window.openPencil?.getStore?.()
        const pageNode = store?.graph.getNode(store.state.currentPageId)
        if (!store || !pageNode?.guides?.length) throw new Error('No guide')
        store.graph.updateNode(pageNode.id, {
          guides: pageNode.guides.map((guide) => ({ ...guide, position }))
        })
      }, GUIDE_Y)
      await page.mouse.move(x, y + 30)
      await page.mouse.move(x, y, { steps: 4 })
      await settle(page)
      // Short of the canvas's edge, where the Design panel begins.
      const right = Math.min(other.x + other.width + 120, area.x + area.width - 4)
      return picture(
        page,
        { x: area.x, y: area.y, width: right - area.x, height: card.y + card.height + 40 - area.y },
        10
      )
    }
  }
}
