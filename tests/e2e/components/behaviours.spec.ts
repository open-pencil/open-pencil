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

/**
 * A Switch set whose State=On and State=Off variants differ, and an Off instance below it,
 * either on the page or inside a frame, as a settings row holds one.
 */
async function createSwitch({ nested = false } = {}) {
  return editor.page.evaluate((inFrame) => {
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
async function addSwitchBehaviour() {
  const section = propertySection(editor.page, 'Behaviour')
  await section.getByRole('button', { name: 'Add behaviour' }).click()
  await editor.page.getByRole('option', { name: /Switch/ }).click()
  await section.getByRole('combobox', { name: 'Checked' }).click()
  await editor.page.getByRole('option', { name: 'State' }).click()
  await expect(section.getByText('Ready', { exact: true })).toBeVisible()
}

test('a Switch behaviour flips in preview and leaves the document alone', async () => {
  const ids = await createSwitch()
  await editor.canvas.waitForRender()
  await addSwitchBehaviour()

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

test('a switch inside a frame, named after its variant, toggles both ways in preview', async () => {
  // Its layer path includes its name, which a variant switch used to rename to State=On.
  const ids = await createSwitch({ nested: true })
  await editor.canvas.waitForRender()
  await addSwitchBehaviour()

  await startPreview()
  const control = island(ids.islandId).getByRole('switch')
  for (const checked of ['true', 'false', 'true']) {
    await control.click()
    await expect(control).toHaveAttribute('aria-checked', checked)
  }
  await editor.page.keyboard.press('Escape')
})

/**
 * A slider component at 20 of 0 to 100 in steps of 10, its range a slot inside its track's
 * slot, as Reka draws it and Figma keeps it, and an instance of it below.
 */
async function createSlider() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const solid = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const slot = (propertyId: string) => [{ propertyId, field: 'SLOT_CONTENT' as const }]
    const slider = graph.createNode('COMPONENT', pageId, {
      name: 'Volume',
      x: 120,
      y: 120,
      width: 200,
      height: 20,
      componentPropertyDefinitions: ['Track', 'Range', 'Thumb'].map((name) => ({
        id: `${name.toLowerCase()}-slot`,
        name,
        type: 'SLOT' as const,
        defaultValue: ''
      }))
    })
    const track = graph.createNode('FRAME', slider.id, {
      name: 'Track',
      componentPropertyReferences: slot('track-slot'),
      y: 8,
      width: 200,
      height: 4,
      fills: solid(0.8, 0.8, 0.85)
    })
    graph.createNode('FRAME', track.id, {
      name: 'Range',
      componentPropertyReferences: slot('range-slot'),
      width: 40,
      height: 4,
      fills: solid(0.2, 0.6, 1)
    })
    graph.createNode('FRAME', slider.id, {
      name: 'Thumb',
      componentPropertyReferences: slot('thumb-slot'),
      x: 30,
      width: 20,
      height: 20,
      cornerRadius: 10,
      fills: solid(1, 1, 1)
    })
    store.setBehaviour(slider.id, {
      kind: 'slider',
      booleans: {},
      texts: {},
      numbers: { value: { min: 0, max: 100, step: 10, default: 20 } },
      parts: { track: 'track-slot', range: 'range-slot', thumb: 'thumb-slot' }
    })
    const instance = graph.createInstance(slider.id, pageId, { x: 120, y: 260 })
    if (!instance) throw new Error('Instance not created')
    return instance.id
  })
}

// In an instance the range is part of the track's content, and preview still has Reka place it.
test('a slider instance in preview moves the range inside its track', async () => {
  const instanceId = await createSlider()
  await editor.canvas.waitForRender()
  await startPreview()

  const control = island(instanceId).getByRole('slider')
  const range = island(instanceId).locator('[data-layer$="Range"]')
  const width = async () => (await range.boundingBox())?.width ?? 0
  await expect(control).toHaveAttribute('aria-valuenow', '20')
  // A range that shows, so twice its width is a real change.
  await expect.poll(width).toBeGreaterThan(0)
  const before = await width()
  await control.press('ArrowRight')
  await control.press('ArrowRight')
  await expect(control).toHaveAttribute('aria-valuenow', '40')
  // Twice the value, twice the range: Reka places it, the design's width no longer stands.
  await expect.poll(width).toBeCloseTo(before * 2, 0)
  await editor.page.keyboard.press('Escape')
})

// Tabs as the shadcn/ui kit draws them: triggers are instances of a Tab set that draws
// Selected On and Off and a disabled look.
test('tabs whose triggers are Tab instances show the chosen one and skip a disabled one', async () => {
  const ids = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const solid = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const slot = (propertyId: string) => [{ propertyId, field: 'SLOT_CONTENT' as const }]
    const tab = graph.createNode('COMPONENT_SET', pageId, {
      name: 'Tab',
      x: 120,
      y: 60,
      width: 300,
      height: 40,
      componentPropertyDefinitions: [
        {
          id: 'selected',
          name: 'Selected',
          type: 'VARIANT' as const,
          defaultValue: 'Off',
          variantOptions: ['Off', 'On']
        },
        {
          id: 'state',
          name: 'State',
          type: 'VARIANT' as const,
          defaultValue: 'Default',
          variantOptions: ['Default', 'Disabled']
        }
      ]
    })
    const variants = new Map<string, string>()
    for (const [index, [selected, state]] of [
      ['Off', 'Default'],
      ['On', 'Default'],
      ['Off', 'Disabled']
    ].entries()) {
      const name = `Selected=${selected}, State=${state}`
      const variant = graph.createNode('COMPONENT', tab.id, {
        name,
        x: 10 + index * 90,
        y: 8,
        width: 80,
        height: 24,
        fills: selected === 'On' ? solid(0.2, 0.4, 1) : solid(0.85, 0.85, 0.9),
        opacity: state === 'Disabled' ? 0.5 : 1,
        componentPropertyValues: { Selected: selected, State: state }
      })
      variants.set(name, variant.id)
    }
    store.setBehaviour(tab.id, {
      kind: 'tab',
      booleans: { value: { propertyId: 'selected', on: 'On', off: 'Off' } },
      texts: {},
      numbers: {},
      parts: {},
      states: { propertyId: 'state', rest: 'Default', disabled: 'Disabled' }
    })
    const tabs = graph.createNode('COMPONENT', pageId, {
      name: 'Settings',
      x: 120,
      y: 140,
      width: 260,
      height: 120
    })
    const list = graph.createNode('FRAME', tabs.id, {
      name: 'List',
      componentPropertyReferences: slot('list-slot'),
      width: 260,
      height: 24
    })
    const panels = graph.createNode('FRAME', tabs.id, {
      name: 'Panels',
      componentPropertyReferences: slot('panels-slot'),
      y: 30,
      width: 260,
      height: 80
    })
    for (const [index, [label, values]] of [
      ['Account', 'Selected=On, State=Default'],
      ['Password', 'Selected=Off, State=Default'],
      ['Billing', 'Selected=Off, State=Disabled']
    ].entries()) {
      const main = variants.get(values)
      if (!main) throw new Error(`No ${values}`)
      graph.createInstance(main, list.id, { name: label, x: index * 86 })
      graph.createNode('FRAME', panels.id, {
        name: `${label} panel`,
        width: 260,
        height: 80,
        visible: index === 0
      })
    }
    store.setBehaviour(tabs.id, {
      kind: 'tabs',
      booleans: {},
      texts: {},
      numbers: {},
      parts: { list: 'list-slot', panels: 'panels-slot' }
    })
    const instance = graph.createInstance(tabs.id, pageId, { x: 120, y: 300 })
    if (!instance) throw new Error('Instance not created')
    return { instanceId: instance.id }
  })
  await editor.canvas.waitForRender()
  await startPreview()

  const triggers = island(ids.instanceId).getByRole('tab')
  await expect(triggers).toHaveCount(3)
  const [account, password, billing] = [triggers.nth(0), triggers.nth(1), triggers.nth(2)]
  const fill = (trigger: typeof account) =>
    trigger.evaluate((element) => getComputedStyle(element).backgroundColor)
  await expect(account).toHaveAttribute('aria-selected', 'true')
  const selectedFill = await fill(account)
  const restFill = await fill(password)
  expect(selectedFill).not.toBe(restFill)

  await password.click()
  await expect(password).toHaveAttribute('aria-selected', 'true')
  // Each Tab instance now shows its Selected variant as the choice says.
  await expect.poll(() => fill(password)).toBe(selectedFill)
  await expect.poll(() => fill(account)).toBe(restFill)

  // Drawn disabled, Billing is a disabled trigger: clicking it changes nothing.
  await expect(billing).toBeDisabled()
  await billing.click({ force: true })
  await expect(password).toHaveAttribute('aria-selected', 'true')
  await expect(billing).toHaveAttribute('aria-selected', 'false')
  await editor.page.keyboard.press('Escape')
})

test('preview islands move with the frames the canvas draws, not ahead of them', async () => {
  const ids = await createSwitch({ nested: true })
  await editor.canvas.waitForRender()
  await addSwitchBehaviour()
  await startPreview()
  await expect(island(ids.islandId).getByRole('switch')).toBeVisible()

  const layer = editor.page.getByTestId('play-islands').locator(':scope > div')
  const placed = await layer.evaluate((element) => element.style.transform)
  // Hold the canvas's drawing, as a slow frame does, and move the view meanwhile.
  const held = await editor.page.evaluateHandle(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const preparation = store.preparationController.begin({
      kind: 'document-open',
      phase: 'materializing'
    })
    store.pan(80, 40)
    return preparation
  })
  try {
    await editor.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
    expect(await layer.evaluate((element) => element.style.transform)).toBe(placed)

    // Drawing resumes: the islands follow the pan, which the canvas has now drawn.
    await held.evaluate((preparation) => preparation.complete())
    await expect.poll(() => layer.evaluate((element) => element.style.transform)).not.toBe(placed)
  } finally {
    // Never leave the canvas held for later tests; completing again does nothing.
    await held.evaluate((preparation) => preparation.complete())
    await held.dispose()
  }
  await editor.page.keyboard.press('Escape')
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
  // Only a form control has an invalid state.
  await expect(section.getByRole('combobox', { name: 'Invalid state' })).toHaveCount(0)

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
