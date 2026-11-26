import { expect, type Page } from '@playwright/test'

import { propertySection } from '#tests/helpers/properties'

/** The live island a previewing canvas runs for a top-level layer. */
export function island(page: Page, layerId: string) {
  return page.locator(`[data-island="${layerId}"]`)
}

export async function startPreview(page: Page) {
  await page.keyboard.press('ControlOrMeta+Alt+Enter')
  await expect(page.getByRole('button', { name: /Leave preview/ })).toBeVisible()
}

/**
 * A Switch set whose State=On and State=Off variants differ, and an Off instance below it,
 * either on the page or inside a frame, as a settings row holds one.
 */
export async function createSwitch(page: Page, { nested = false } = {}) {
  return page.evaluate((inFrame) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const solid = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const set = graph.createNode('COMPONENT_SET', pageId, {
      name: 'Switch',
      x: 120,
      y: 120,
      width: 200,
      height: 80,
      componentPropertyDefinitions: [
        {
          id: 'state',
          name: 'State',
          type: 'VARIANT',
          defaultValue: 'Off',
          variantOptions: ['On', 'Off']
        }
      ]
    })
    const variant = (value: string, index: number, on: boolean) => {
      const component = graph.createNode('COMPONENT', set.id, {
        name: `State=${value}`,
        x: 20 + index * 90,
        y: 20,
        width: 56,
        height: 32,
        cornerRadius: 16,
        fills: on ? solid(0.2, 0.6, 1) : solid(0.8, 0.8, 0.85),
        componentPropertyValues: { State: value }
      })
      graph.createNode('ELLIPSE', component.id, {
        name: 'Knob',
        x: on ? 28 : 4,
        y: 4,
        width: 24,
        height: 24,
        fills: solid(1, 1, 1)
      })
      return component
    }
    variant('On', 0, true)
    const off = variant('Off', 1, false)
    const row = inFrame
      ? graph.createNode('FRAME', pageId, {
          name: 'Settings',
          x: 120,
          y: 260,
          width: 200,
          height: 60
        })
      : undefined
    const instance = row
      ? graph.createInstance(off.id, row.id, { x: 12, y: 12 })
      : graph.createInstance(off.id, pageId, { x: 120, y: 260 })
    if (!instance) throw new Error('Instance not created')
    store.select([set.id])
    return {
      setId: set.id,
      offId: off.id,
      instanceId: instance.id,
      islandId: row?.id ?? instance.id
    }
  }, nested)
}

/** Adds the Switch behaviour to the selected set, binding its value to State. */
export async function addSwitchBehaviour(page: Page) {
  const section = propertySection(page, 'Behaviour')
  await section.getByRole('button', { name: 'Add behaviour' }).click()
  await page.getByRole('option', { name: /Switch/ }).click()
  await section.getByRole('combobox', { name: 'Checked' }).click()
  await page.getByRole('option', { name: 'State' }).click()
  await expect(section.getByText('Ready', { exact: true })).toBeVisible()
}
