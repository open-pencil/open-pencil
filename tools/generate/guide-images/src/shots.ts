import type { Locator, Page } from '@playwright/test'

import type { Rect } from '@open-pencil/scene-graph/primitives'

import {
  boxOf,
  buildScene,
  layerBox,
  selectLayer,
  settle,
  showPlain,
  within,
  type Keyboard
} from './app.ts'
import { inside, type Callout, type Picture } from './compose.ts'
import { SCENE_RADIUS, gallery, playlist, tags } from './scenes.ts'

export interface Shot {
  /** The keyboard whose shortcuts the picture shows; the Mac's unless it says. */
  keyboard?: Keyboard
  take: (page: Page) => Promise<Picture>
}

const PANEL_RADIUS = 10
/** Cards shown in pairs, at a size where two fit side by side. */
const PAIR_ZOOM = 0.86

async function picture(
  page: Page,
  clip: Rect,
  radius: number,
  extra: Partial<Picture> = {}
): Promise<Picture> {
  // Playwright cuts a clip at the window's edge, which would stretch the picture.
  const window = page.viewportSize()
  if (!window || clip.y < 0 || clip.y + clip.height > window.height) {
    throw new Error('The picture does not fit the window')
  }
  const png = await page.screenshot({ clip })
  return { png, width: clip.width, height: clip.height, radius, ...extra }
}

async function plainFrame(page: Page, jsx: string, name: string, zoom: number): Promise<Picture> {
  await buildScene(page, jsx, zoom)
  await showPlain(page)
  return picture(page, await layerBox(page, [name]), SCENE_RADIUS * zoom)
}

const panelText = (page: Page, text: string) => page.getByText(text, { exact: true }).last()

/** The Design panel from a heading down to `bottom`. */
async function panelClip(page: Page, heading: string, bottom: Rect): Promise<Rect> {
  // Inside the border the panel shares with the canvas, and the scrollbar's edge.
  const panel = await boxOf(page.getByTestId('properties-panel'))
  const y = (await boxOf(panelText(page, heading))).y - 7
  return { x: panel.x + 2, y, width: panel.width - 4, height: bottom.y + bottom.height + 8 - y }
}

/** A callout on a control's near edge; `down` moves it off the middle, past a neighbor. */
async function callout(
  clip: Rect,
  number: number,
  side: Callout['side'],
  control: Locator,
  down = 0.5
): Promise<Callout> {
  const edge = within(await boxOf(control), side === 'left' ? 0 : 1, down)
  return { number, side, at: inside(clip, edge) }
}

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

async function copyMenu(page: Page): Promise<Picture> {
  await buildScene(page, playlist())
  const corner = within(await layerBox(page, ['Playlist']), 0.03, 0.03)
  await page.mouse.click(corner.x, corner.y, { button: 'right' })
  await page.getByTestId('context-copy-paste-as').hover()
  await settle(page)
  const menu = await boxOf(page.getByRole('menu').last())
  // Without the menu's own border, which the card draws.
  const clip = { x: menu.x + 1, y: menu.y + 1, width: menu.width - 2, height: menu.height - 2 }
  return picture(page, clip, PANEL_RADIUS)
}

/** Every picture in the guide, by its page and name. */
export const SHOTS: Record<string, Shot> = {
  'auto-layout/before': {
    take: (page) => plainFrame(page, playlist(2), 'Playlist', PAIR_ZOOM)
  },
  'auto-layout/after': {
    take: (page) => plainFrame(page, playlist(), 'Playlist', PAIR_ZOOM)
  },
  'auto-layout/panel': {
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
  'auto-layout/sizing': {
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
  'auto-layout/drag': {
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
  'auto-layout/drop': {
    async take(page) {
      await buildScene(page, playlist(), PAIR_ZOOM)
      await dragSong(page)
      await page.mouse.up()
      await showPlain(page)
      return picture(page, await layerBox(page, ['Playlist']), SCENE_RADIUS * PAIR_ZOOM)
    }
  },
  'auto-layout/wrap': { take: (page) => plainFrame(page, tags(), 'Tags', 1.4) },
  'auto-layout/grid': { take: (page) => plainFrame(page, gallery(), 'Gallery', 1.1) },
  'auto-layout/grid-panel': {
    async take(page) {
      await buildScene(page, gallery())
      await page.mouse.move(700, 120)
      const gaps = await boxOf(page.getByRole('spinbutton').filter({ hasText: /^12$/ }).first())
      const clip = await panelClip(page, 'Columns', gaps)
      return picture(page, { ...clip, height: clip.height - 4 }, PANEL_RADIUS)
    }
  },
  'exporting/panel': {
    async take(page) {
      await buildScene(page, playlist())
      const add = page.getByRole('button', { name: 'Add export' })
      await add.click()
      await add.click()
      const toggle = page.getByRole('button', { name: 'Preview', exact: true }).first()
      await toggle.click()
      const preview = page.locator('img[src^="blob:"]').last()
      await preview.waitFor()
      // The preview's section slides open, and scrolling must wait for its full height.
      await settle(page)
      await preview.evaluate((image) => image.scrollIntoView({ block: 'center' }))
      await page.mouse.move(700, 120)
      await settle(page)
      const clip = await panelClip(page, 'Export', await boxOf(preview))
      const scale = page.locator('[data-property="export-scale"]').first().locator('xpath=..')
      const format = page.locator('[data-property="export-format"]').first()
      const callouts = [
        await callout(clip, 1, 'left', scale),
        // Above the middle, where the row's remove button is.
        await callout(clip, 2, 'right', format, 0.2),
        await callout(clip, 3, 'left', page.getByTestId('export-button')),
        await callout(clip, 4, 'left', toggle)
      ]
      return picture(page, clip, PANEL_RADIUS, { callouts })
    }
  },
  'exporting/copy-as': { take: copyMenu },
  'exporting/copy-as-other': { keyboard: 'other', take: copyMenu },
  'files/open-url': {
    async take(page) {
      await page.getByRole('menuitem', { name: 'File', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Open from URL…' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('textbox').fill('https://example.com')
      await settle(page)
      const box = await boxOf(dialog)
      const clip = { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 }
      return picture(page, clip, PANEL_RADIUS)
    }
  }
}
