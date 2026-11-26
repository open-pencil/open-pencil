import { boxOf, buildScene, layerBox, settle, showPlain } from '#guide-images/app'
import { inside } from '#guide-images/compose'
import { SCENE_RADIUS, buttons, toggle } from '#guide-images/scenes'
import { PANEL_RADIUS, panelClip, picture, type Shot } from '#guide-images/shots/shared'
import type { Page } from '@playwright/test'

const ZOOM = 1.3

/** Selects the first layer of `type` named `name`, at any depth. */
async function selectWhere(page: Page, type: string, name: string) {
  await page.evaluate(
    ({ wanted, called }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('No store')
      const walk = (id: string): string | undefined => {
        for (const child of store.graph.getChildren(id)) {
          if (child.type === wanted && child.name === called) return child.id
          const found = walk(child.id)
          if (found) return found
        }
        return undefined
      }
      const id = walk(store.state.currentPageId)
      if (!id) throw new Error(`No ${wanted} ${called}`)
      store.select([id])
    },
    { wanted: type, called: name }
  )
  await page.mouse.move(700, 120)
  await settle(page)
}

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  overview: {
    async take(page) {
      await buildScene(page, buttons(), ZOOM)
      await showPlain(page)
      const board = await layerBox(page, ['Board'])
      const set = await layerBox(page, ['Board', 'Button'])
      const variant = await layerBox(page, ['Board', 'Button', 'Variant=Primary'])
      // The instance is the board's second Button; the first is the set.
      const second = await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const boardNode = store?.graph.getChildren(store.state.currentPageId).at(0)
        const node = boardNode && store?.graph.getChildren(boardNode.id).at(1)
        if (!store || !node) throw new Error('No instance')
        return node.id
      })
      const instanceBox = await page.evaluate((id) => {
        const store = window.openPencil?.getStore?.()
        const canvas = document.querySelector('[data-test-id="canvas-element"]')
        const node = store?.graph.getNode(id)
        if (!store || !canvas || !node) throw new Error('No instance')
        const { x, y } = store.graph.getAbsolutePosition(id)
        const { left, top } = canvas.getBoundingClientRect()
        const { zoom, panX, panY } = store.state
        return {
          x: left + x * zoom + panX,
          y: top + y * zoom + panY,
          width: node.width * zoom,
          height: node.height * zoom
        }
      }, second)
      const callouts = [
        {
          number: 1,
          side: 'left' as const,
          at: inside(board, { x: set.x, y: set.y + set.height * 0.8 })
        },
        {
          number: 2,
          side: 'left' as const,
          at: inside(board, { x: variant.x, y: variant.y + variant.height / 2 })
        },
        {
          number: 3,
          side: 'right' as const,
          at: inside(board, {
            x: instanceBox.x + instanceBox.width,
            y: instanceBox.y + instanceBox.height / 2
          })
        }
      ]
      return picture(page, board, SCENE_RADIUS * ZOOM, { callouts })
    }
  },
  assets: {
    async take(page) {
      await buildScene(page, buttons())
      await page.getByTestId('left-panel-assets-tab').click()
      await page.mouse.move(700, 120)
      await settle(page)
      const panel = await boxOf(page.getByTestId('layers-panel'))
      const search = await boxOf(page.getByTestId('layers-panel').locator('input').first())
      const label = await boxOf(
        page.getByTestId('layers-panel').getByText('Button', { exact: true }).last()
      )
      const top = search.y - 8
      return picture(
        page,
        { x: panel.x, y: top, width: panel.width - 1, height: label.y + label.height + 14 - top },
        PANEL_RADIUS
      )
    }
  },
  instance: {
    async take(page) {
      await buildScene(page, buttons())
      await selectWhere(page, 'INSTANCE', 'Button')
      const variant = await boxOf(
        page.getByTestId('properties-panel').getByText('Primary', { exact: true }).first()
      )
      const clip = await panelClip(page, 'Component properties', variant)
      return picture(page, { ...clip, height: clip.height + 4 }, PANEL_RADIUS)
    }
  },
  property: {
    async take(page) {
      await buildScene(page, buttons())
      await selectWhere(page, 'COMPONENT_SET', 'Button')
      await page.getByTestId('properties-panel').getByText('Label', { exact: true }).first().click()
      await settle(page)
      const popover = await boxOf(page.locator('[data-reka-popper-content-wrapper]').last())
      const clip = {
        x: popover.x + 1,
        y: popover.y + 1,
        width: popover.width - 2,
        height: popover.height - 2
      }
      return picture(page, clip, 12)
    }
  },
  behaviour: {
    async take(page) {
      await buildScene(page, toggle())
      await page.mouse.move(700, 120)
      const panel = page.getByTestId('properties-panel')
      await panel
        .getByText('Behaviour', { exact: true })
        .first()
        .evaluate((heading) => {
          // Near the top of the panel, with room above for the clip: the tabs stay out of it.
          heading.scrollIntoView({ block: 'start' })
          let scroller = heading.parentElement
          while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
            scroller = scroller.parentElement
          }
          scroller?.scrollBy(0, -48)
        })
      await settle(page)
      const next = await boxOf(panel.getByText('Position', { exact: true }).first())
      const clip = await panelClip(page, 'Behaviour', {
        x: next.x,
        y: next.y - 24,
        width: 0,
        height: 0
      })
      return picture(page, clip, PANEL_RADIUS)
    }
  }
}
