import { expect, expectInViewport, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { propertyItems, propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

function designPanel() {
  return editor.page.getByTestId('design-panel-single')
}

function fillSection() {
  return propertySection(editor.page, 'Fill')
}

function strokeSection() {
  return propertySection(editor.page, 'Stroke')
}

function positionSection() {
  return propertySection(editor.page, 'Position')
}

function effectsSection() {
  return propertySection(editor.page, 'Effects')
}

function getNode(id: string) {
  return editor.page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const n = store.graph.getNode(nodeId)
    if (!n) return null
    return {
      fills: n.fills,
      strokes: n.strokes,
      effects: n.effects,
      opacity: n.opacity,
      visible: n.visible,
      blendMode: n.blendMode,
      isMask: n.isMask,
      maskType: n.maskType,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rotation: n.rotation
    }
  }, id)
}

function getSelectedId() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds][0] ?? null
  })
}

function getSelectedIds() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds]
  })
}

test('selecting a rectangle shows design panel with type and name', async () => {
  await editor.canvas.drawRect(100, 100, 120, 80)
  await editor.canvas.waitForRender()

  await expect(designPanel()).toBeVisible()
  await expect(designPanel().getByRole('img', { name: 'RECTANGLE' })).toBeVisible()
  await expect(designPanel().getByRole('heading', { name: 'Rectangle' })).toBeVisible()
  await expect(designPanel()).toHaveScreenshot('design-panel-position-appearance.png')
})

test('position section shows X, Y, rotation inputs', async () => {
  await expect(positionSection()).toBeVisible()

  const inputs = propertySection(editor.page, 'Position').getByRole('spinbutton')
  const count = await inputs.count()
  expect(count).toBeGreaterThanOrEqual(3)
})

test('fill section appears with default fill', async () => {
  await expect(fillSection()).toBeVisible()

  const fillItems = propertyItems(editor.page, 'fills')
  await expect(fillItems.first()).toBeVisible()
})

test('fill item shows color swatch', async () => {
  const swatch = fillSection().getByTestId('fill-picker-swatch').first()
  await expect(swatch).toBeVisible()
})

test('clicking color area changes fill color', async () => {
  const id = await getSelectedId()
  const before = await getNode(expectDefined(id, 'selected id'))

  const swatch = fillSection().getByTestId('fill-picker-swatch').first()
  await swatch.click()

  const colorArea = editor.page.locator('.cursor-crosshair').first()
  await expect(colorArea).toBeVisible({ timeout: 5000 })

  const box = await colorArea.boundingBox()
  await editor.page.mouse.click(
    expectDefined(box, 'color area bounds').x + expectDefined(box, 'color area bounds').width - 10,
    expectDefined(box, 'color area bounds').y + 10
  )
  await editor.canvas.waitForRender()
  await editor.page.waitForTimeout(100)

  const after = await getNode(expectDefined(id, 'selected id'))
  const c1 = expectDefined(before, 'before node').fills[0].color
  const c2 = expectDefined(after, 'after node').fills[0].color
  expect(c1.r !== c2.r || c1.g !== c2.g || c1.b !== c2.b).toBe(true)

  // Close popover — click the swatch again to toggle it off
  await swatch.click()
  await editor.canvas.waitForRender()
})

test('adding a stroke creates stroke section item', async () => {
  const addBtn = strokeSection().getByRole('button', { name: 'Add stroke' })
  await addBtn.click()
  await editor.canvas.waitForRender()

  const strokeItems = propertyItems(editor.page, 'strokes')
  await expect(strokeItems.first()).toBeVisible()

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').strokes.length).toBe(1)
})

test('adding an effect creates effect item', async () => {
  const addBtn = effectsSection().getByRole('button', { name: 'Add effect' })
  await addBtn.click()
  await editor.canvas.waitForRender()

  const effectItems = propertyItems(editor.page, 'effects')
  await expect(effectItems.first()).toBeVisible()

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').effects.length).toBe(1)
})

test('effect settings expand semantically and row remove reveals on hover', async () => {
  const effectItem = propertyItems(editor.page, 'effects').first()
  const expand = effectItem.locator('[data-property="effect-expand"]')
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expand.click()
  await expect(expand).toHaveAttribute('aria-expanded', 'true')
  await expect(editor.page.locator('[data-slot="effect-settings"]')).toBeVisible()

  const remove = effectItem.getByRole('button', { name: 'Remove effect' })
  await expect(remove).toHaveCSS('opacity', '1')
  await editor.page.getByRole('tab', { name: 'Design' }).focus()
  await editor.page.mouse.move(0, 0)
  await expect(remove).toHaveCSS('opacity', '0')
  await effectItem.hover()
  await expect(remove).toHaveCSS('opacity', '1')
})

test('paint effect and export rows share compact visual anatomy', async () => {
  const exportSection = propertySection(editor.page, 'Export')
  await exportSection.getByRole('button', { name: 'Add export' }).click()
  await editor.canvas.waitForRender()

  for (const sectionName of ['Position', 'Layout', 'Appearance']) {
    await propertySection(editor.page, sectionName)
      .getByRole('button', { name: sectionName })
      .click()
  }
  await editor.page.mouse.move(0, 0)

  await expect(designPanel()).toHaveScreenshot('design-panel-paint-effects-export.png')

  for (const sectionName of ['Position', 'Layout', 'Appearance']) {
    await propertySection(editor.page, sectionName)
      .getByRole('button', { name: sectionName })
      .click()
  }
})

test('adding a second fill shows two fill items', async () => {
  const addBtn = fillSection().getByRole('button', { name: 'Add fill' })
  await addBtn.click()
  await editor.canvas.waitForRender()

  const fillItems = propertyItems(editor.page, 'fills')
  expect(await fillItems.count()).toBe(2)

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').fills.length).toBe(2)
})

test('blend mode select updates the selected layer', async () => {
  const id = await getSelectedId()
  const blendModeSelect = propertySection(editor.page, 'Appearance').getByRole('combobox', {
    name: 'Blend mode'
  })
  await expect(blendModeSelect).toBeVisible()

  await blendModeSelect.click()
  await editor.page.getByRole('option', { name: 'Multiply' }).click()
  await editor.canvas.waitForRender()

  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node').blendMode).toBe('MULTIPLY')
})

test('multi-select blend mode change is one undo step', async () => {
  await editor.canvas.drawRect(300, 100, 60, 60)
  await editor.canvas.drawRect(400, 100, 60, 60)
  await editor.canvas.selectAll()
  await editor.canvas.waitForRender()

  const ids = await getSelectedIds()
  expect(ids.length).toBeGreaterThanOrEqual(2)
  const previousBlendModes = await Promise.all(
    ids.map(async (id) => expectDefined(await getNode(id), 'selected node').blendMode)
  )

  const blendModeSelect = propertySection(editor.page, 'Appearance').getByRole('combobox', {
    name: 'Blend mode'
  })
  await blendModeSelect.click()
  await editor.page.getByRole('option', { name: 'Multiply' }).click()
  await editor.canvas.waitForRender()

  for (const id of ids) {
    expect(expectDefined(await getNode(id), 'selected node').blendMode).toBe('MULTIPLY')
  }

  await editor.canvas.undo()
  const afterUndo = await Promise.all(
    ids.map(async (id) => expectDefined(await getNode(id), 'selected node').blendMode)
  )
  expect(afterUndo).toEqual(previousBlendModes)

  await editor.canvas.redo()
  const afterRedo = await Promise.all(
    ids.map(async (id) => expectDefined(await getNode(id), 'selected node').blendMode)
  )
  expect(afterRedo).toEqual(ids.map(() => 'MULTIPLY'))
})

test('mask action toggles mask section and mask type control', async () => {
  await editor.canvas.drawRect(500, 100, 60, 60)
  await editor.canvas.waitForRender()
  const id = await getSelectedId()
  const maskAction = editor.page.getByTestId('selection-toggle-mask')
  await expect(maskAction).toBeVisible()

  await expect(propertySection(editor.page, 'Mask')).toHaveCount(0)
  await maskAction.click()
  await editor.canvas.waitForRender()

  let node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node').isMask).toBe(true)
  const maskSection = propertySection(editor.page, 'Mask')
  await expect(maskSection).toBeVisible()

  const maskTypeSelect = maskSection.getByRole('combobox', { name: 'Mask type' })
  await maskTypeSelect.click()
  await editor.page.getByRole('option', { name: 'Luminance' }).click()
  await editor.canvas.waitForRender()

  node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node').maskType).toBe('LUMINANCE')

  await maskAction.click()
  await editor.canvas.waitForRender()
  node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node').isMask).toBe(false)
  await expect(propertySection(editor.page, 'Mask')).toHaveCount(0)
})

test('visibility toggle in appearance section works', async () => {
  const visBtn = propertySection(editor.page, 'Appearance').getByRole('button', {
    name: 'Toggle visibility'
  })
  await expect(visBtn).toBeVisible()

  const id = await getSelectedId()
  const before = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(before, 'before node').visible).toBe(true)

  await visBtn.click()
  await editor.canvas.waitForRender()

  const after = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(after, 'after node').visible).toBe(false)

  await visBtn.click()
  await editor.canvas.waitForRender()

  const restored = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(restored, 'restored node').visible).toBe(true)
})

test('fill stroke and effect visibility toggles update on repeated clicks and support undo redo', async () => {
  const id = await getSelectedId()
  expect(id).toBeTruthy()

  const fillButton = propertyItems(editor.page, 'fills')
    .first()
    .getByRole('button', { name: 'Toggle visibility' })
  await expect(fillButton).toBeVisible()

  const initial = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(initial, 'initial node').fills[0]?.visible).toBe(true)

  await fillButton.click()
  await editor.canvas.waitForRender()
  await expect(fillButton).toHaveAttribute('aria-pressed', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(false)

  await fillButton.click()
  await editor.canvas.waitForRender()
  await expect(fillButton).toHaveAttribute('aria-pressed', 'true')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(true)

  await editor.canvas.undo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(false)
  await editor.canvas.redo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(true)

  const strokeAddButton = strokeSection().getByRole('button', { name: 'Add stroke' })
  await strokeAddButton.click()
  await editor.canvas.waitForRender()

  const strokeButton = propertyItems(editor.page, 'strokes')
    .first()
    .getByRole('button', { name: 'Toggle visibility' })
  await expect(strokeButton).toBeVisible()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(true)

  await strokeButton.click()
  await editor.canvas.waitForRender()
  await expect(strokeButton).toHaveAttribute('aria-pressed', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(false)

  await strokeButton.click()
  await editor.canvas.waitForRender()
  await expect(strokeButton).toHaveAttribute('aria-pressed', 'true')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(true)

  await editor.canvas.undo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(false)
  await editor.canvas.redo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(true)

  const effectAddButton = effectsSection().getByRole('button', { name: 'Add effect' })
  await effectAddButton.click()
  await editor.canvas.waitForRender()

  const effectButton = propertyItems(editor.page, 'effects')
    .first()
    .getByRole('button', { name: 'Toggle visibility' })
  await expect(effectButton).toBeVisible()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(true)

  await effectButton.click()
  await editor.canvas.waitForRender()
  await expect(effectButton).toHaveAttribute('aria-pressed', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(false)

  await effectButton.click()
  await editor.canvas.waitForRender()
  await expect(effectButton).toHaveAttribute('aria-pressed', 'true')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(true)

  await editor.canvas.undo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(false)
  await editor.canvas.redo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(true)
})

test('deselecting shows empty design panel', async () => {
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  await expect(editor.page.getByTestId('design-panel-empty')).toBeVisible()
})

test('multi-select shows mixed header and boolean operations', async () => {
  await editor.canvas.drawRect(300, 100, 60, 60)
  await editor.canvas.drawRect(400, 100, 60, 60)
  await editor.canvas.selectAll()
  await editor.canvas.waitForRender()

  const multiHeader = editor.page
    .getByTestId('design-panel-multi')
    .getByRole('heading', { name: /layers/ })
  await expect(multiHeader).toBeVisible()

  const booleanOperations = editor.page.getByTestId('boolean-operations-trigger')
  await booleanOperations.hover()
  await expect(
    editor.page.locator('[role=tooltip]').filter({ hasText: 'Boolean operations' })
  ).toBeVisible()

  await booleanOperations.click()
  await expect(
    editor.page.locator('[role=tooltip]').filter({ hasText: 'Boolean operations' })
  ).toHaveCount(0)
  const booleanUnion = editor.page.getByTestId('boolean-operation-booleanUnion')
  await expect(booleanUnion).toBeVisible()
  await expectInViewport(editor.page, booleanUnion)
  await expect(editor.page.getByTestId('boolean-operation-booleanSubtract')).toBeVisible()
  await expect(editor.page.getByTestId('boolean-operation-booleanIntersect')).toBeVisible()
  await expect(editor.page.getByTestId('boolean-operation-booleanExclude')).toBeVisible()
  await expect(editor.page.getByTestId('boolean-operation-flatten')).toBeVisible()
})
