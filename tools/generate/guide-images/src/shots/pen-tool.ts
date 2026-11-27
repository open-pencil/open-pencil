import type { Page } from '@playwright/test'

import { buildScene, layerBox, settle, showPlain } from '../app.ts'
import { SCENE_RADIUS } from '../scenes.ts'
import { PAIR_ZOOM, picture, type Shot } from './shared.ts'

const ZOOM = PAIR_ZOOM * 1.4
const BOARD = `<Frame name="Board" w={260} h={200} bg="#FFFFFF" rounded={${SCENE_RADIUS}} />`

/** Draws two points and a curve with the pen, leaving the pointer where a third would go. */
async function drawPath(page: Page) {
  await buildScene(page, BOARD, ZOOM)
  await showPlain(page)
  const board = await layerBox(page, ['Board'])
  const at = (x: number, y: number) => ({ x: board.x + x * ZOOM, y: board.y + y * ZOOM })
  await page.keyboard.press('p')
  const start = at(50, 160)
  await page.mouse.click(start.x, start.y)
  const top = at(120, 40)
  await page.mouse.move(top.x, top.y)
  await page.mouse.down()
  await page.mouse.move(top.x + 50 * ZOOM, top.y, { steps: 6 })
  await page.mouse.up()
  // Off the first point's height, so no alignment guide shows.
  const end = at(210, 150)
  await page.mouse.move(end.x, end.y, { steps: 4 })
  await settle(page)
  return { board, end }
}

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  drawing: {
    async take(page) {
      const { board } = await drawPath(page)
      return picture(page, board, SCENE_RADIUS * ZOOM)
    }
  },
  done: {
    async take(page) {
      const { board, end } = await drawPath(page)
      await page.mouse.click(end.x, end.y)
      await page.keyboard.press('Enter')
      await showPlain(page)
      return picture(page, board, SCENE_RADIUS * ZOOM)
    }
  }
}

export { drawPath }
