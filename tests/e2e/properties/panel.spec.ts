import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { propertyField, propertyItems, propertySection } from '#tests/helpers/properties'
import { getPageChildren, getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()

test('property sections collapse and reopen from their title', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  const section = propertySection(editor.page, 'Appearance')
  const title = section.getByRole('button', { name: 'Appearance' })
  const blendMode = section.getByRole('combobox', { name: 'Blend mode' })
  await expect(blendMode).toBeVisible()
  await title.click()
  await expect(blendMode).toBeHidden()
  await expect(title).toHaveAttribute('data-state', 'closed')
  await title.click()
  await expect(blendMode).toBeVisible()
})

test('appearance fields share control height and show variable actions', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  const section = propertySection(editor.page, 'Appearance')
  const controls = [
    section.getByRole('combobox', { name: 'Blend mode' }),
    section.getByRole('spinbutton', { name: 'Opacity' }),
    section.getByRole('spinbutton', { name: 'Radius' }),
    section.getByRole('spinbutton', { name: 'Corner smoothing' })
  ]
  for (const control of controls) {
    await expect(control).toHaveCSS('height', '24px')
  }

  const applyVariable = section.getByRole('button', { name: 'Apply variable' }).first()
  await expect(applyVariable).toBeVisible()
  await expect(applyVariable).toHaveCSS('opacity', '1')
  await expect(applyVariable).toHaveCSS('width', '20px')
  await expect(applyVariable).toHaveCSS('height', '20px')

  await applyVariable.hover()
  await expect(applyVariable).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  await applyVariable.click()
  const search = editor.page.getByPlaceholder('Search')
  const picker = editor.page.locator('[data-slot=content]').filter({ has: search })
  await expect(picker).toBeVisible()
  const triggerBox = expectDefined(await applyVariable.boundingBox(), 'variable trigger bounds')
  const pickerBox = expectDefined(await picker.boundingBox(), 'variable picker bounds')
  expect(pickerBox.x + pickerBox.width).toBeLessThan(triggerBox.x)
  expect(
    Math.abs(pickerBox.y + pickerBox.height / 2 - (triggerBox.y + triggerBox.height / 2))
  ).toBeLessThan(4)
  await search.press('Escape')

  const fillItem = propertyItems(editor.page, 'fills').first()
  const paintField = fillItem.locator('[data-slot="paint-field"]')
  await expect(paintField).toHaveCSS('height', '24px')
  const colorBox = expectDefined(
    await fillItem.getByRole('textbox', { name: 'Fill' }).boundingBox(),
    'fill color bounds'
  )
  const opacityBox = expectDefined(
    await fillItem.getByRole('spinbutton', { name: 'Opacity' }).boundingBox(),
    'fill opacity bounds'
  )
  expect(colorBox.width).toBeGreaterThanOrEqual(42)
  expect(opacityBox.width).toBeGreaterThanOrEqual(40)
})

test('NumberField drag changes X position', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 80, 80)
  const before = await getSelectedNode(editor.page)
  const initialX = expectDefined(before, 'selected rectangle before drag').x

  const xField = propertyField(editor.page, 'x')
  await editor.canvas.dragNumberField(xField, 50)

  const after = await getSelectedNode(editor.page)
  expect(after?.x).not.toBe(initialX)
  editor.canvas.assertNoErrors()
})

test('corner radius uniform sets cornerRadius', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  const scrubContainer = propertyField(editor.page, 'cornerRadius')
  await scrubContainer.click()
  await editor.canvas.waitForRender()
  const input = scrubContainer.getByRole('spinbutton', { name: 'Radius' })
  await input.fill('12')
  await input.press('Enter')
  await editor.canvas.waitForRender()

  const node = await getSelectedNode(editor.page)
  expect(node?.cornerRadius).toBe(12)
  editor.canvas.assertNoErrors()
})

test('independent corners toggle shows four corner inputs', async () => {
  await propertySection(editor.page, 'Appearance')
    .getByRole('button', { name: 'Independent corner radii' })
    .click()
  await editor.canvas.waitForRender()

  await expect(propertyField(editor.page, 'topLeftRadius')).toBeVisible()
  await expect(propertyField(editor.page, 'topRightRadius')).toBeVisible()
  await expect(propertyField(editor.page, 'bottomRightRadius')).toBeVisible()
  await expect(propertyField(editor.page, 'bottomLeftRadius')).toBeVisible()
  editor.canvas.assertNoErrors()
})

test('fill gradient switch changes fill type', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.pressKey('Escape')
  await editor.canvas.waitForRender()
  // fresh rect with default solid fill
  await editor.canvas.drawRect(300, 300, 80, 80)
  await editor.canvas.waitForRender()

  await expect(propertySection(editor.page, 'Fill')).toBeVisible({ timeout: 5000 })

  const fillItem = propertyItems(editor.page, 'fills').first()
  await expect(fillItem).toBeVisible({ timeout: 5000 })
  const fillSwatch = fillItem.getByTestId('fill-picker-swatch')
  await expect(fillSwatch).toBeVisible({ timeout: 5000 })
  await fillSwatch.click()
  await editor.canvas.waitForRender()

  await editor.page.getByTestId('fill-picker-tab-gradient').click()
  await editor.canvas.waitForRender()

  const node = expectDefined(await getSelectedNode(editor.page), 'gradient-filled node')
  expect(node.fills[0]?.type).toBe('GRADIENT_LINEAR')
  await fillSwatch.click()
  editor.canvas.assertNoErrors()
})

test('variable bind badge appears on fill', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const col = store.graph.createCollection('Colors')
    const v = store.graph.createVariable('brand-red', 'COLOR', col.id, { r: 1, g: 0, b: 0, a: 1 })
    const id = [...store.state.selectedIds][0]
    if (!id) return
    store.graph.bindVariable(id, 'fills/0/color', v.id)
    store.state.sceneVersion++
  })
  await editor.canvas.waitForRender()

  await expect(propertyItems(editor.page, 'fills').first().getByText('brand-red')).toBeVisible()
  editor.canvas.assertNoErrors()
})

test('fill color can bind an existing variable', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  const variableId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const col = store.graph.createCollection('Colors')
    const variable = store.graph.createVariable('test-brand-red', 'COLOR', col.id, {
      r: 1,
      g: 0,
      b: 0,
      a: 1
    })
    store.state.sceneVersion++
    return variable.id
  })
  await editor.canvas.waitForRender()

  const fillItem = propertyItems(editor.page, 'fills').first()
  await fillItem.getByLabel('Apply variable').click()
  await editor.page.getByText('test-brand-red', { exact: true }).click()
  await editor.canvas.waitForRender()

  await expect(fillItem.getByText('test-brand-red')).toBeVisible()
  const fillSwatch = fillItem.getByTestId('fill-picker-swatch')
  await expect(fillSwatch.locator('[data-slot="swatch"] > span')).toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)'
  )
  await fillSwatch.click()
  const redInput = editor.page.getByRole('spinbutton', { name: 'Red' })
  await expect(redInput).toHaveValue('255')
  await redInput.fill('0')
  await redInput.press('Enter')
  await fillSwatch.click()
  await expect(editor.page.locator('[data-picker-content]')).toHaveCount(0)
  await editor.canvas.waitForRender()
  await expect(fillItem.getByText('test-brand-red')).toHaveCount(0)
  const undoLabel = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.undo.undoLabel
  })
  expect(undoLabel).toBe('Change fill color')
  const boundVariableId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    return id ? (store.getNode(id)?.boundVariables['fills/0/color'] ?? null) : null
  })
  expect(boundVariableId).toBeNull()

  await editor.canvas.undo()
  await editor.canvas.waitForRender()
  const undoLabelAfter = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.undo.undoLabel
  })
  expect(undoLabelAfter).toBe('Bind variable')
  const restoredBinding = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    return id ? store.getNode(id)?.boundVariables['fills/0/color'] : undefined
  })
  expect(restoredBinding).toBe(variableId)
  await expect(fillItem.getByText('test-brand-red')).toBeVisible()
  editor.canvas.assertNoErrors()
})

test('bound fill picker opens non-destructively and Escape rolls back color edits', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  const before = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const collection = store.graph.createCollection('Colors')
    const variable = store.graph.createVariable('rollback-brand', 'COLOR', collection.id, {
      r: 1,
      g: 0,
      b: 0,
      a: 1
    })
    const id = [...store.state.selectedIds][0]
    if (!id) throw new Error('Expected selected node')
    store.graph.bindVariable(id, 'fills/0/color', variable.id)
    store.state.sceneVersion++
    const node = store.getNode(id)
    return { color: node?.fills[0]?.color, binding: node?.boundVariables['fills/0/color'] }
  })
  await editor.canvas.waitForRender()

  const fillItem = propertyItems(editor.page, 'fills').first()
  await fillItem.getByTestId('fill-picker-swatch').click()
  await expect(fillItem.getByText('rollback-brand')).toBeVisible()

  const opened = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    const node = id ? store.getNode(id) : null
    return { color: node?.fills[0]?.color, binding: node?.boundVariables['fills/0/color'] }
  })
  expect(opened).toEqual(before)

  const area = editor.page.locator('.cursor-crosshair').first()
  const box = expectDefined(await area.boundingBox(), 'color area bounds')
  await editor.page.mouse.click(box.x + box.width - 8, box.y + 8)
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  const after = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    const node = id ? store.getNode(id) : null
    return { color: node?.fills[0]?.color, binding: node?.boundVariables['fills/0/color'] }
  })
  expect(after).toEqual(before)
  await expect(fillItem.getByText('rollback-brand')).toBeVisible()
  editor.canvas.assertNoErrors()
})

test('fill color can create and bind a variable', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  const fillItem = propertyItems(editor.page, 'fills').first()
  await fillItem.getByLabel('Apply variable').click()
  await expect(editor.page.getByText(/Create color variable from #?[0-9A-F]{6}/)).toBeVisible()
  await editor.page.getByText(/Create color variable from #?[0-9A-F]{6}/).click()
  await editor.page.getByPlaceholder('Variable name').fill('Surface/default')
  await editor.page.getByRole('button', { name: 'Create', exact: true }).click()
  await editor.canvas.waitForRender()

  await expect(fillItem.getByText('Surface/default')).toBeVisible()
  const boundVariable = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const node = store.getNode(id)
    const variableId = node?.boundVariables['fills/0/color']
    return variableId ? store.getVariable(variableId)?.name : null
  })
  expect(boundVariable).toBe('Surface/default')
  editor.canvas.assertNoErrors()
})

test('width can create, bind, and detach a number variable', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)
  const widthField = propertyField(editor.page, 'width')

  await widthField.getByLabel('Apply variable').click()
  await editor.page.getByText('Create number variable from 80').click()
  await editor.page.getByPlaceholder('Variable name').fill('Card/width')
  await editor.page.getByRole('button', { name: 'Create', exact: true }).click()
  await editor.canvas.waitForRender()

  await expect(widthField.getByText('Card/width')).toBeVisible()
  const boundVariable = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const node = store.getNode(id)
    const variableId = node?.boundVariables.width
    return variableId ? store.getVariable(variableId)?.name : null
  })
  expect(boundVariable).toBe('Card/width')

  await widthField.focus()
  const widthInput = widthField.getByRole('spinbutton')
  await widthInput.fill('120')
  await widthInput.press('Enter')
  await editor.canvas.waitForRender()

  await expect(widthField.getByText('Card/width')).toHaveCount(0)
  const directWidth = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    const node = id ? store.getNode(id) : null
    return node ? { width: node.width, binding: node.boundVariables.width ?? null } : null
  })
  expect(directWidth).toEqual({ width: 120, binding: null })
  editor.canvas.assertNoErrors()
})

test('bound NumberField detach edit is one undo step', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  const field = propertyField(editor.page, 'cornerRadius')
  await field.getByLabel('Apply variable').click()
  await editor.page.getByText('Create number variable from 0').click()
  await editor.page.getByPlaceholder('Variable name').fill('Radius/default')
  await editor.page.getByRole('button', { name: 'Create', exact: true }).click()
  await editor.canvas.waitForRender()
  await expect(field.getByText('Radius/default')).toBeVisible()

  const readState = () =>
    editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const id = [...store.state.selectedIds][0]
      const node = id ? store.getNode(id) : null
      const variableId = node?.boundVariables.cornerRadius
      return node
        ? {
            radius: node.cornerRadius,
            binding: variableId ? store.getVariable(variableId)?.name : null
          }
        : null
    })

  await field.click({ position: { x: 40, y: 13 } })
  const input = field.getByRole('spinbutton', { name: 'Radius' })
  await input.press('Tab')
  expect(await readState()).toEqual({ radius: 0, binding: 'Radius/default' })
  await editor.canvas.pressKey('Meta+z')
  await editor.canvas.waitForRender()
  expect(await readState()).toEqual({ radius: 0, binding: null })
  await editor.canvas.pressKey('Meta+Shift+z')
  await editor.canvas.waitForRender()
  expect(await readState()).toEqual({ radius: 0, binding: 'Radius/default' })

  await field.getByLabel('Apply variable').click()
  await expect(editor.page.getByPlaceholder('Search')).toBeVisible()
  await editor.page.getByPlaceholder('Search').press('Escape')
  expect(await readState()).toEqual({ radius: 0, binding: 'Radius/default' })

  await field.click({ position: { x: 40, y: 13 } })
  await input.fill('12')
  await input.press('Escape')
  await editor.canvas.waitForRender()
  expect(await readState()).toEqual({ radius: 0, binding: 'Radius/default' })

  await field.click({ position: { x: 40, y: 13 } })
  await input.fill('24')
  await input.press('Enter')
  await editor.canvas.waitForRender()
  expect(await readState()).toEqual({ radius: 24, binding: null })
  await editor.canvas.pressKey('Meta+z')
  await editor.canvas.waitForRender()
  expect(await readState()).toEqual({ radius: 0, binding: 'Radius/default' })
  editor.canvas.assertNoErrors()
})

test('alignment buttons align nodes to same X', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(50, 200, 60, 60)
  await editor.canvas.drawRect(250, 200, 60, 60)
  await editor.canvas.pressKey('Meta+a')
  await editor.canvas.waitForRender()

  await propertySection(editor.page, 'Position').getByRole('button', { name: 'Align left' }).click()
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  expect(children.length).toBe(2)
  expect(children[0].x).toBe(children[1].x)
  editor.canvas.assertNoErrors()
})

test('flip horizontal sets flipX', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  await propertySection(editor.page, 'Position')
    .getByRole('button', { name: 'Flip horizontal' })
    .click()
  await editor.canvas.waitForRender()

  const node = await getSelectedNode(editor.page)
  expect(node?.flipX).toBe(true)
  editor.canvas.assertNoErrors()
})

test('clip content checkbox toggles clipsContent', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.pressKey('f')
  await editor.canvas.drag(100, 100, 300, 300)
  await editor.canvas.waitForRender()

  // Enable auto-layout so the clip-content checkbox is visible
  await editor.canvas.pressKey('Shift+a')
  await editor.canvas.waitForRender()

  const before = expectDefined(await getSelectedNode(editor.page), 'selected frame before clipping')
  const initialValue = before.clipsContent

  await editor.page.getByTestId('clip-content-checkbox').click()
  await editor.canvas.waitForRender()

  const after = await getSelectedNode(editor.page)
  expect(after?.clipsContent).toBe(!initialValue)
  editor.canvas.assertNoErrors()
})
