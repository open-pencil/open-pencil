import type { Locator, Page } from '@playwright/test'

import type { Rect } from '@open-pencil/scene-graph/primitives'

import { boxOf, buildScene, layerBox, showPlain, within, type Keyboard } from '../app.ts'
import { inside, type Callout, type Picture } from '../compose.ts'
import { SCENE_RADIUS } from '../scenes.ts'

export interface Shot {
  /** The keyboard whose shortcuts the picture shows; the Mac's unless it says. */
  keyboard?: Keyboard
  /** The window, when the picture needs another size than a laptop's. */
  window?: { width: number; height: number }
  take: (page: Page) => Promise<Picture>
}

export const PANEL_RADIUS = 10
/** Cards shown in pairs, at a size where two fit side by side. */
export const PAIR_ZOOM = 0.86

export async function picture(
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

export async function plainFrame(
  page: Page,
  jsx: string,
  name: string,
  zoom: number
): Promise<Picture> {
  await buildScene(page, jsx, zoom)
  await showPlain(page)
  return picture(page, await layerBox(page, [name]), SCENE_RADIUS * zoom)
}

export const panelText = (page: Page, text: string) => page.getByText(text, { exact: true }).last()

/** The Design panel from a heading down to `bottom`. */
export async function panelClip(page: Page, heading: string, bottom: Rect): Promise<Rect> {
  // Inside the border the panel shares with the canvas, and the scrollbar's edge.
  const panel = await boxOf(page.getByTestId('properties-panel'))
  const y = (await boxOf(panelText(page, heading))).y - 7
  return { x: panel.x + 2, y, width: panel.width - 4, height: bottom.y + bottom.height + 8 - y }
}

/** A callout on a control's near edge; `down` moves it off the middle, past a neighbor. */
export async function callout(
  clip: Rect,
  number: number,
  side: Callout['side'],
  control: Locator,
  down = 0.5
): Promise<Callout> {
  const edge = within(await boxOf(control), side === 'left' ? 0 : 1, down)
  return { number, side, at: inside(clip, edge) }
}

/** The open menu, without its own border, which the card draws. */
export async function menuPicture(page: Page): Promise<Picture> {
  const menu = await boxOf(page.getByRole('menu').last())
  const clip = { x: menu.x + 1, y: menu.y + 1, width: menu.width - 2, height: menu.height - 2 }
  return picture(page, clip, PANEL_RADIUS)
}
