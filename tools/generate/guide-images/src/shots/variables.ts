import type { Page } from '@playwright/test'

import { boxOf, buildScene, selectLayer, settle, within } from '../app.ts'
import type { Callout } from '../compose.ts'
import { inside } from '../compose.ts'
import { themedCard } from '../scenes.ts'
import { PANEL_RADIUS, picture, type Shot } from './shared.ts'

/** The Design panel's row of a section, such as Fill, below its heading. */
async function sectionHeading(page: Page, heading: string) {
  const title = page.getByTestId('properties-panel').getByText(heading, { exact: true }).first()
  await title.scrollIntoViewIfNeeded()
  return boxOf(title)
}

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  dialog: {
    // Wide enough for both modes and the settings beside them.
    window: { width: 1180, height: 760 },
    async take(page) {
      await buildScene(page, themedCard())
      await page.evaluate(() => window.openPencil?.getStore?.()?.clearSelection())
      await page.getByTestId('menubar-view').click()
      await page.getByRole('menuitem', { name: 'Variables…' }).click()
      await page.mouse.move(5, 5)
      await settle(page)
      const dialog = await boxOf(page.getByTestId('variables-dialog'))
      const clip = {
        x: dialog.x + 1,
        y: dialog.y + 1,
        width: dialog.width - 2,
        height: dialog.height - 2
      }
      const on = async (
        number: number,
        text: string,
        across: number,
        offsetX = 0
      ): Promise<Callout> => {
        const box = await boxOf(
          page.getByTestId('variables-dialog').getByText(text, { exact: true }).first()
        )
        const at = within(box, across, 0.5)
        return { number, side: 'on', at: inside(clip, { x: at.x + offsetX, y: at.y }) }
      }
      // Headings fill their column, so each number sits a set distance from the heading's start.
      const callouts = [
        await on(1, 'Collections', 0, 100),
        await on(2, 'Name', 0, 64),
        await on(3, 'Collection', 0, 96),
        await on(4, 'Stylesheet', 0, 96)
      ]
      return picture(page, clip, 14, { callouts })
    }
  },
  apply: {
    async take(page) {
      await buildScene(page, themedCard())
      await selectLayer(page, ['Card', 'Action'])
      await page.mouse.move(700, 120)
      const fill = await sectionHeading(page, 'Fill')
      const buttons = await page
        .getByTestId('properties-panel')
        .getByRole('button', { name: /variable/i })
        .evaluateAll((all) =>
          all.map((button) => {
            const { x, y, width, height } = button.getBoundingClientRect()
            return { x, y, width, height }
          })
        )
      const button = buttons.find((box) => box.y > fill.y && box.y < fill.y + 60)
      if (!button) throw new Error('No variable button on the fill')
      await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2)
      await settle(page)
      const popover = await boxOf(page.locator('[data-reka-popper-content-wrapper]').last())
      const panel = await boxOf(page.getByTestId('properties-panel'))
      const top = fill.y - 8
      const left = popover.x - 12
      const bottom = Math.max(popover.y + popover.height, button.y + button.height) + 12
      return picture(
        page,
        { x: left, y: top, width: panel.x + panel.width - 2 - left, height: bottom - top },
        PANEL_RADIUS
      )
    }
  },
  mode: {
    async take(page) {
      await buildScene(page, themedCard())
      await page.mouse.move(700, 120)
      // Near the top of the panel, so the list has room to open below.
      await page
        .getByTestId('properties-panel')
        .getByText('Appearance', { exact: true })
        .first()
        .evaluate((heading) => heading.scrollIntoView({ block: 'start' }))
      await settle(page)
      const appearance = await sectionHeading(page, 'Appearance')
      // The mode select is labelled with its collection's name.
      const select = page.getByTestId('properties-panel').getByRole('combobox', { name: 'Theme' })
      const trigger = await boxOf(select)
      await select.click()
      await settle(page)
      const list = await boxOf(page.getByRole('listbox').or(page.getByRole('menu')).last())
      const panel = await boxOf(page.getByTestId('properties-panel'))
      // The list opens above or below the select, whichever has room.
      const top = Math.min(appearance.y, list.y) - 8
      const bottom = Math.max(list.y + list.height, trigger.y + trigger.height) + 10
      return picture(
        page,
        { x: panel.x + 2, y: top, width: panel.width - 4, height: bottom - top },
        PANEL_RADIUS
      )
    }
  }
}
