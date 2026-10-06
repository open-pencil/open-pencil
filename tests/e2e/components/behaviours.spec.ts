import { colorToCSS } from '@open-pencil/scene-graph/color'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetupWithClear('/?test&no-rulers')

/** The live island a previewing canvas runs for a top-level layer. */
function island(layerId: string) {
  return editor.page.locator(`[data-island="${layerId}"]`)
}

async function startPreview() {
  await editor.page.keyboard.press('ControlOrMeta+Alt+Enter')
  await expect(editor.page.getByRole('button', { name: /Leave preview/ })).toBeVisible()
}

/** A Switch set whose State=On and State=Off variants differ, and an Off instance below it. */
async function createSwitch() {
  return editor.page.evaluate(() => {
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
    const instance = graph.createInstance(off.id, pageId, { x: 120, y: 260 })
    if (!instance) throw new Error('Instance not created')
    store.select([set.id])
    return { setId: set.id, offId: off.id, instanceId: instance.id }
  })
}

test('a Switch behaviour flips in preview and leaves the document alone', async () => {
  const ids = await createSwitch()
  await editor.canvas.waitForRender()

  const section = propertySection(editor.page, 'Behaviour')
  await section.getByRole('button', { name: 'Add behaviour' }).click()
  await editor.page.getByRole('option', { name: /Switch/ }).click()
  await section.getByRole('combobox', { name: 'Checked' }).click()
  await editor.page.getByRole('option', { name: 'State' }).click()
  await expect(section.getByText('Ready', { exact: true })).toBeVisible()

  await startPreview()
  // The instance runs as Reka UI's Switch, drawn by the set's variants.
  const control = island(ids.instanceId).getByRole('switch')
  await expect(control).toHaveAttribute('aria-checked', 'false')
  await control.click()
  await expect(control).toHaveAttribute('aria-checked', 'true')
  await editor.page.mouse.move(4, 400)
  await expect(island(ids.instanceId)).toHaveScreenshot('switch-island-on.png')
  await control.press('Space')
  await expect(control).toHaveAttribute('aria-checked', 'false')
  await control.click()

  const document = await editor.page.evaluate((instanceId) => {
    const store = window.openPencil?.getStore?.()
    return store?.graph.getNode(instanceId)?.componentId
  }, ids.instanceId)
  expect(document).toBe(ids.offId)

  await editor.page.keyboard.press('Escape')
  await expect(editor.page.getByRole('button', { name: /Leave preview/ })).toHaveCount(0)
  // Editing again: the panels and their Preview button are back.
  await expect(editor.page.getByRole('button', { name: /^Preview/ })).toBeVisible()
})

test('a Button behaviour maps its states and shows them in preview', async () => {
  const ids = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const values = ['Default', 'Hover', 'Pressed', 'Focus', 'Disabled']
    const set = graph.createNode('COMPONENT_SET', pageId, {
      name: 'Button',
      x: 120,
      y: 120,
      width: 520,
      height: 80,
      componentPropertyDefinitions: [
        {
          id: 'interaction',
          name: 'Interaction',
          type: 'VARIANT',
          defaultValue: 'Default',
          variantOptions: values
        }
      ]
    })
    const components = values.map((value, index) =>
      graph.createNode('COMPONENT', set.id, {
        name: `Interaction=${value}`,
        x: 20 + index * 100,
        y: 24,
        width: 80,
        height: 32,
        cornerRadius: 8,
        fills: [
          {
            type: 'SOLID' as const,
            color: { r: 0.2 + index * 0.15, g: 0.4, b: 0.9 - index * 0.15, a: 1 },
            opacity: 1,
            visible: true
          }
        ],
        componentPropertyValues: { Interaction: value }
      })
    )
    const instance = graph.createInstance(components[0].id, pageId, { x: 120, y: 260 })
    if (!instance) throw new Error('Instance not created')
    store.select([set.id])
    return {
      instanceId: instance.id,
      byValue: Object.fromEntries(values.map((value, index) => [value, components[index].id]))
    }
  })
  await editor.canvas.waitForRender()

  const section = propertySection(editor.page, 'Behaviour')
  await section.getByRole('button', { name: 'Add behaviour' }).click()
  await editor.page.getByRole('option', { name: /Button/ }).click()
  await section.getByRole('combobox', { name: 'States' }).click()
  await editor.page.getByRole('option', { name: 'Interaction' }).click()
  // Values named like states are mapped to them.
  await expect(section.getByRole('combobox', { name: 'Hover state' })).toHaveText(/Hover/)
  await expect(section.getByRole('combobox', { name: 'Pressed state' })).toHaveText(/Pressed/)
  await expect(section.getByRole('combobox', { name: 'Disabled state' })).toHaveText(/Disabled/)

  await startPreview()
  // Each state shows its variant's fill: the components are filled by index, as created above.
  const fill = (index: number) =>
    colorToCSS({ r: 0.2 + index * 0.15, g: 0.4, b: 0.9 - index * 0.15, a: 1 })
  const button = island(ids.instanceId).getByRole('button')
  await expect(button).toHaveCSS('background-color', fill(0))
  await button.hover()
  await expect(button).toHaveCSS('background-color', fill(1))
  await editor.page.mouse.down()
  await expect(button).toHaveCSS('background-color', fill(2))
  await editor.page.mouse.up()
  await expect(button).toHaveCSS('background-color', fill(1))
  await editor.page.mouse.move(4, 400)
  await expect(button).toHaveCSS('background-color', fill(0))
  await editor.page.keyboard.press('Escape')
  await expect(editor.page.getByRole('button', { name: /Leave preview/ })).toHaveCount(0)
})

test('a Text field takes typing in preview without triggering shortcuts', async () => {
  const instanceId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const component = graph.createNode('COMPONENT', pageId, {
      name: 'Field',
      x: 120,
      y: 120,
      width: 200,
      height: 36,
      cornerRadius: 6,
      fills: [
        { type: 'SOLID' as const, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }
      ],
      componentPropertyDefinitions: [
        { id: 'value', name: 'Value', type: 'TEXT', defaultValue: 'Name' }
      ]
    })
    graph.createNode('TEXT', component.id, {
      name: 'Value',
      x: 10,
      y: 10,
      width: 180,
      height: 16,
      text: 'Name',
      componentPropertyReferences: [{ propertyId: 'value', field: 'TEXT' }]
    })
    store.setBehaviour(component.id, {
      kind: 'textField',
      booleans: {},
      texts: { value: { propertyId: 'value' } },
      numbers: {},
      parts: {}
    })
    const instance = graph.createInstance(component.id, pageId, { x: 120, y: 220 })
    if (!instance) throw new Error('Instance not created')
    return instance.id
  })
  await editor.canvas.waitForRender()

  await startPreview()
  // A real input: typing, the caret, and selection are the browser's.
  const input = island(instanceId).locator('input')
  await expect(input).toHaveValue('Name')
  await input.click()
  await editor.page.keyboard.press('End')
  // R, T, and V are tool shortcuts while editing.
  await editor.page.keyboard.type(' Vera T')
  await editor.page.keyboard.press('Home')
  await editor.page.keyboard.press('Shift+ArrowRight')
  await editor.page.keyboard.type('S')
  await expect(input).toHaveValue('Same Vera T')
  expect(await editor.page.evaluate(() => window.openPencil?.getStore?.()?.state.activeTool)).toBe(
    'SELECT'
  )
  await editor.page.getByRole('button', { name: /Leave preview/ }).click()
  await expect(island(instanceId)).toHaveCount(0)
})

test('a rectangle made a Textarea gets its text layer from the panel and takes typing', async () => {
  const componentId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const component = store.graph.createNode('COMPONENT', store.state.currentPageId, {
      name: 'Component',
      x: 120,
      y: 120,
      width: 220,
      height: 120,
      fills: [
        {
          type: 'SOLID' as const,
          color: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
    store.select([component.id])
    return component.id
  })
  await editor.canvas.waitForRender()

  const section = propertySection(editor.page, 'Behaviour')
  await section.getByRole('button', { name: 'Add behaviour' }).click()
  await editor.page.getByRole('option', { name: /Textarea/ }).click()
  await expect(section.getByRole('status')).toHaveText('Still needed: Text.')
  await section.getByRole('button', { name: 'Add text layer' }).click()
  await expect(section.getByText('Ready', { exact: true })).toBeVisible()

  const instanceId = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    const instance = store?.graph.createInstance(id, store.state.currentPageId, { x: 120, y: 300 })
    return instance?.id ?? ''
  }, componentId)
  await startPreview()
  const field = island(instanceId).locator('textarea')
  await field.click()
  await editor.page.keyboard.press('End')
  await editor.page.keyboard.type(' typed')
  await editor.page.keyboard.press('Enter')
  await editor.page.keyboard.type('second line')
  await expect(field).toHaveValue('Text typed\nsecond line')
})
