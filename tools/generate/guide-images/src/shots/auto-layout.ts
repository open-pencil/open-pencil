import type { Page } from '@playwright/test'

import { boxOf, buildScene, layerBox, selectLayer, settle, showPlain, within } from '../app.ts'
import { inside } from '../compose.ts'
import { SCENE_RADIUS, gallery, playlist, tags } from '../scenes.ts'
import {
  PAIR_ZOOM,
  PANEL_RADIUS,
  callout,
  panelClip,
  panelText,
  picture,
  plainFrame,
  type Shot
} from './shared.ts'

/** Drags the last song above the second, leaving the button down. */
async function dragSong(page: Page) {
  await selectLayer(page, ['Playlist', 'Low Tide'])
  const from = within(await layerBox(page, ['Playlist', 'Low Tide']), 0.75, 0.5)
  const to = within(await layerBox(page, ['Playlist', 'Paper Lanterns']), 0.75, 0)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x, from.y - 20, { steps: 5 })
  await page.mouse.move(to.x, to.y - 4, { steps: 15 })
  await settle(page)
  return { x: to.x, y: to.y - 4 }
}

/** The pictures on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  before: {
    take: (page) => plainFrame(page, playlist(2), 'Playlist', PAIR_ZOOM)
  },
  after: {
    take: (page) => plainFrame(page, playlist(), 'Playlist', PAIR_ZOOM)
  },
  panel: {
    async take(page) {
      await buildScene(page, playlist())
      await page.mouse.move(700, 120)
      const clip = await panelClip(
        page,
        'Auto layout',
        await boxOf(panelText(page, 'Clip content'))
      )
      const widthField = page.locator('[data-slot="sizing-trigger"]').first().locator('xpath=..')
      const callouts = [
        await callout(clip, 1, 'left', page.getByLabel('Flow', { exact: true }).first()),
        await callout(clip, 2, 'right', page.getByLabel('Wrap layout').first()),
        await callout(clip, 3, 'right', widthField),
        await callout(clip, 4, 'left', page.getByTestId('layout-alignment-grid')),
        await callout(clip, 5, 'right', page.getByTestId('layout-gap-input')),
        await callout(clip, 6, 'left', page.getByTestId('layout-horizontal-padding-input'))
      ]
      return picture(page, clip, PANEL_RADIUS, { callouts })
    }
  },
  sizing: {
    async take(page) {
      await buildScene(page, playlist())
      await selectLayer(page, ['Playlist', 'Slow Morning'])
      await page.locator('[data-slot="sizing-trigger"]').first().click()
      await settle(page)
      const bottom = await boxOf(page.getByTestId('layout-alignment-grid'))
      const clip = await panelClip(page, 'Dimensions', bottom)
      return picture(page, { ...clip, y: clip.y + 2, height: clip.height - 6 }, PANEL_RADIUS)
    }
  },
  drag: {
    async take(page) {
      // Drawn large and shown small, so the selection's labels stay inside the card.
      await buildScene(page, playlist())
      const pointer = await dragSong(page)
      const clip = await layerBox(page, ['Playlist'])
      const { png } = await picture(page, clip, 0)
      const scale = PAIR_ZOOM / 1.4
      const at = inside(clip, pointer)
      return {
        png,
        width: clip.width * scale,
        height: clip.height * scale,
        radius: SCENE_RADIUS * PAIR_ZOOM,
        pointer: { x: at.x * scale, y: at.y * scale }
      }
    }
  },
  drop: {
    async take(page) {
      await buildScene(page, playlist(), PAIR_ZOOM)
      await dragSong(page)
      await page.mouse.up()
      await showPlain(page)
      return picture(page, await layerBox(page, ['Playlist']), SCENE_RADIUS * PAIR_ZOOM)
    }
  },
  wrap: { take: (page) => plainFrame(page, tags(), 'Tags', 1.4) },
  grid: { take: (page) => plainFrame(page, gallery(), 'Gallery', 1.1) },
  'grid-panel': {
    async take(page) {
      await buildScene(page, gallery())
      await page.mouse.move(700, 120)
      const gaps = await boxOf(page.getByRole('spinbutton').filter({ hasText: /^12$/ }).first())
      const clip = await panelClip(page, 'Columns', gaps)
      return picture(page, { ...clip, height: clip.height - 4 }, PANEL_RADIUS)
    }
  }
}
