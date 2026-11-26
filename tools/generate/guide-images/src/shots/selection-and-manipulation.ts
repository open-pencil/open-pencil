import type { Page } from '@playwright/test'

import { boxOf, buildScene, layerBox, selectLayer, settle, showPlain, within } from '../app.ts'
import { inside } from '../compose.ts'
import { SCENE_RADIUS, playlist } from '../scenes.ts'
import { PAIR_ZOOM, PANEL_RADIUS, panelClip, picture, type Shot } from './shared.ts'

/** The rotation handle's distance above a layer, in screen pixels (core's ROTATION_HANDLE_DISTANCE). */
const ROTATION_HANDLE = 24

/** Clicks the playlist's second song `clicks` times, where its title is. */
async function clickSong(page: Page, clicks: number) {
  await buildScene(page, playlist(), PAIR_ZOOM)
  await showPlain(page)
  const title = within(
    await layerBox(page, ['Playlist', 'Paper Lanterns', 'Info', 'Title']),
    0.3,
    0.5
  )
  await page.mouse.click(title.x, title.y, { clickCount: clicks })
  await page.mouse.move(700, 120)
  await settle(page)
  return picture(page, await layerBox(page, ['Playlist']), SCENE_RADIUS * PAIR_ZOOM)
}

/** Loose shapes on a board without auto layout, where a box from an empty spot selects them. */
const SHAPES = `<Frame name="Board" w={360} h={200} bg="#FFFFFF" rounded={${SCENE_RADIUS}}>
  <Rectangle name="Square" x={32} y={40} w={72} h={72} rounded={12} bg="#FB923C" />
  <Ellipse name="Circle" x={144} y={64} w={80} h={80} bg="#8B5CF6" />
  <Rectangle name="Bar" x={256} y={32} w={72} h={136} rounded={12} bg="#0EA5E9" />
</Frame>`

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  click: { take: (page) => clickSong(page, 1) },
  'double-click': { take: (page) => clickSong(page, 2) },
  marquee: {
    async take(page) {
      await buildScene(page, SHAPES, 1)
      await showPlain(page)
      const board = await layerBox(page, ['Board'])
      const from = { x: board.x + 20, y: board.y + 20 }
      const to = within(await layerBox(page, ['Board', 'Circle']), 0.5, 0.55)
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(to.x, to.y, { steps: 12 })
      await settle(page)
      const shot = await picture(page, board, SCENE_RADIUS, { pointer: inside(board, to) })
      await page.mouse.up()
      return shot
    }
  },
  handles: {
    async take(page) {
      await buildScene(page, playlist(), 0.9)
      await selectLayer(page, ['Playlist', 'Paper Lanterns'])
      await page.mouse.move(700, 120)
      await settle(page)
      const card = await layerBox(page, ['Playlist'])
      const row = await layerBox(page, ['Playlist', 'Paper Lanterns'])
      const clip = card
      const callouts = [
        { number: 1, side: 'left' as const, at: inside(clip, { x: row.x, y: row.y + row.height }) },
        {
          number: 2,
          side: 'right' as const,
          at: inside(clip, { x: row.x + row.width / 2 + 4, y: row.y - ROTATION_HANDLE })
        },
        {
          number: 3,
          side: 'right' as const,
          at: inside(clip, { x: row.x + row.width / 2 + 34, y: row.y + row.height + 15 })
        }
      ]
      return picture(page, clip, SCENE_RADIUS * 0.9, { callouts })
    }
  },
  several: {
    async take(page) {
      await buildScene(page, playlist())
      await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const card = store?.graph.getChildren(store.state.currentPageId).at(0)
        if (!store || !card) throw new Error('No playlist')
        store.select(
          store.graph
            .getChildren(card.id)
            .slice(0, 2)
            .map((row) => row.id)
        )
      })
      await page.mouse.move(700, 120)
      await settle(page)
      const bottom = await boxOf(page.getByLabel('Rotation').first())
      const clip = await panelClip(page, '2 selected', bottom)
      return picture(page, clip, PANEL_RADIUS)
    }
  },
  'selection-colors': {
    async take(page) {
      await buildScene(page, playlist())
      await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const card = store?.graph.getChildren(store.state.currentPageId).at(0)
        if (!store || !card) throw new Error('No playlist')
        store.select(
          store.graph
            .getChildren(card.id)
            .slice(0, 2)
            .map((row) => row.id)
        )
      })
      const colors = page.getByTestId('selection-colors')
      await colors.evaluate((section) => section.scrollIntoView({ block: 'center' }))
      await page.mouse.move(700, 120)
      await settle(page)
      const clip = await panelClip(page, 'Selection colors', await boxOf(colors))
      return picture(page, { ...clip, height: clip.height - 8 }, PANEL_RADIUS)
    }
  }
}
