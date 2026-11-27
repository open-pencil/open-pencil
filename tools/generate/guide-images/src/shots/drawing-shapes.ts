import type { Page } from '@playwright/test'

import { toolbarFlyoutTestId } from '@open-pencil/vue/testing'

import { boxOf, buildScene, layerBox, selectLayer, settle } from '../app.ts'
import { SCENE_RADIUS } from '../scenes.ts'
import { PAIR_ZOOM, PANEL_RADIUS, picture, type Shot } from './shared.ts'

const board = (shape: string) =>
  `<Frame name="Board" w={260} h={200} bg="#FFFFFF" rounded={${SCENE_RADIUS}}>${shape}</Frame>`

/** The board with `shape` selected and the pointer over it, which shows its handles. */
async function hovered(page: Page, shape: string, name: string) {
  await buildScene(page, board(shape), PAIR_ZOOM * 1.4)
  await selectLayer(page, ['Board', name])
  const box = await layerBox(page, ['Board', name])
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle(page)
  return picture(page, await layerBox(page, ['Board']), SCENE_RADIUS * PAIR_ZOOM * 1.4)
}

const TALL = { width: 1280, height: 1200 }

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  tools: {
    async take(page) {
      await page.getByTestId(toolbarFlyoutTestId('RECTANGLE')).click()
      await settle(page)
      const toolbar = await boxOf(page.getByTestId('toolbar'))
      const menu = await boxOf(page.getByRole('menu').last())
      const top = menu.y - 12
      const left = Math.min(toolbar.x, menu.x) - 12
      const right = Math.max(toolbar.x + toolbar.width, menu.x + menu.width) + 12
      return picture(
        page,
        { x: left, y: top, width: right - left, height: toolbar.y + toolbar.height + 12 - top },
        PANEL_RADIUS
      )
    }
  },
  corners: {
    take: (page) =>
      hovered(
        page,
        `<Rectangle name="Card" x={50} y={40} w={160} h={120} rounded={12} bg="#8B5CF6" />`,
        'Card'
      )
  },
  star: {
    take: (page) =>
      hovered(page, `<Star name="Star" x={60} y={30} w={140} h={140} bg="#FACC15" />`, 'Star')
  },
  fill: {
    // Tall enough for the Fill section and the picker beside it.
    window: TALL,
    async take(page) {
      await buildScene(
        page,
        board(`<Rectangle name="Card" x={50} y={40} w={160} h={120} rounded={12} bg="#8B5CF6" />`)
      )
      await selectLayer(page, ['Board', 'Card'])
      const panel = page.getByTestId('properties-panel')
      await panel.getByRole('button', { name: 'Fill', exact: true }).first().click()
      await settle(page)
      const picker = page.locator('[data-reka-popper-content-wrapper]').last()
      await picker.getByRole('button', { name: 'Gradient', exact: true }).click()
      await page.mouse.move(5, 5)
      await settle(page)
      const box = await boxOf(picker.locator(':scope > *').first())
      const clip = { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 }
      return picture(page, clip, 14)
    }
  },
  effects: {
    window: TALL,
    async take(page) {
      await buildScene(
        page,
        board(`<Rectangle name="Card" x={50} y={40} w={160} h={120} rounded={12} bg="#8B5CF6" />`)
      )
      await selectLayer(page, ['Board', 'Card'])
      const panel = page.getByTestId('properties-panel')
      await panel.getByRole('button', { name: 'Add effect', exact: true }).click()
      await settle(page)
      await panel.getByText('Drop shadow', { exact: true }).click()
      await settle(page)
      const list = await boxOf(page.getByRole('listbox').last())
      const heading = await boxOf(panel.getByText('Effects', { exact: true }).first())
      const panelBox = await boxOf(panel)
      // Below the line over the section.
      const top = heading.y - 7
      const left = list.x - 12
      return picture(
        page,
        {
          x: left,
          y: top,
          width: panelBox.x + panelBox.width - 2 - left,
          height: list.y + list.height + 12 - top
        },
        PANEL_RADIUS
      )
    }
  }
}
