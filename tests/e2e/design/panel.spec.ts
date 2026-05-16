import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetup()

function designPanel() {
  return editor.page.getByTestId('design-panel-single')
}

function nodeHeader() {
  return editor.page.getByTestId('design-node-header')
}

function fillSection() {
  return editor.page.getByTestId('fill-section')
}

function strokeSection() {
  return editor.page.getByTestId('stroke-section')
}

function positionSection() {
  return editor.page.getByTestId('position-section')
}

function effectsSection() {
  return editor.page.getByTestId('effects-section')
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

test('selecting a rectangle shows design panel with type and name', async () => {
  await editor.canvas.drawRect(100, 100, 120, 80)
  await editor.canvas.waitForRender()

  await expect(designPanel()).toBeVisible()
  await expect(nodeHeader()).toContainText('RECTANGLE')
  await expect(nodeHeader()).toContainText('Rectangle')
})

test('position section shows X, Y, rotation inputs', async () => {
  await expect(positionSection()).toBeVisible()

  const inputs = positionSection().getByTestId('scrub-input')
  const count = await inputs.count()
  expect(count).toBeGreaterThanOrEqual(3)
})

test('fill section appears with default fill', async () => {
  await expect(fillSection()).toBeVisible()

  const fillItems = fillSection().getByTestId('fill-item')
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
  const addBtn = strokeSection().getByTestId('stroke-section-add')
  await addBtn.click()
  await editor.canvas.waitForRender()

  const strokeItems = strokeSection().getByTestId('stroke-item')
  await expect(strokeItems.first()).toBeVisible()

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').strokes.length).toBe(1)
})

test('adding an effect creates effect item', async () => {
  const addBtn = effectsSection().getByTestId('effects-section-add')
  await addBtn.click()
  await editor.canvas.waitForRender()

  const effectItems = effectsSection().getByTestId('effect-item')
  await expect(effectItems.first()).toBeVisible()

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').effects.length).toBe(1)
})

test('adding a second fill shows two fill items', async () => {
  const addBtn = fillSection().getByTestId('fill-section-add')
  await addBtn.click()
  await editor.canvas.waitForRender()

  const fillItems = fillSection().getByTestId('fill-item')
  expect(await fillItems.count()).toBe(2)

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').fills.length).toBe(2)
})

test('visibility toggle in appearance section works', async () => {
  const visBtn = editor.page.getByTestId('appearance-visibility')
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

  const fillButton = editor.page.getByTestId('fill-visibility-0')
  await expect(fillButton).toBeVisible()

  const initial = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(initial, 'initial node').fills[0]?.visible).toBe(true)

  await fillButton.click()
  await editor.canvas.waitForRender()
  await expect(fillButton).toHaveAttribute('data-visible', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(false)

  await fillButton.click()
  await editor.canvas.waitForRender()
  await expect(fillButton).toHaveAttribute('data-visible', 'true')
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

  const strokeAddButton = strokeSection().getByTestId('stroke-section-add')
  await strokeAddButton.click()
  await editor.canvas.waitForRender()

  const strokeButton = editor.page.getByTestId('stroke-visibility-0')
  await expect(strokeButton).toBeVisible()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(true)

  await strokeButton.click()
  await editor.canvas.waitForRender()
  await expect(strokeButton).toHaveAttribute('data-visible', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(false)

  await strokeButton.click()
  await editor.canvas.waitForRender()
  await expect(strokeButton).toHaveAttribute('data-visible', 'true')
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

  const effectAddButton = effectsSection().getByTestId('effects-section-add')
  await effectAddButton.click()
  await editor.canvas.waitForRender()

  const effectButton = editor.page.getByTestId('effect-visibility-0')
  await expect(effectButton).toBeVisible()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(true)

  await effectButton.click()
  await editor.canvas.waitForRender()
  await expect(effectButton).toHaveAttribute('data-visible', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(false)

  await effectButton.click()
  await editor.canvas.waitForRender()
  await expect(effectButton).toHaveAttribute('data-visible', 'true')
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

test('multi-select shows mixed header', async () => {
  await editor.canvas.drawRect(300, 100, 60, 60)
  await editor.canvas.drawRect(400, 100, 60, 60)
  await editor.canvas.selectAll()
  await editor.canvas.waitForRender()

  const multiHeader = editor.page.getByTestId('design-multi-header')
  await expect(multiHeader).toBeVisible()
  await expect(multiHeader).toContainText('Mixed')
  await expect(multiHeader).toContainText('layers')
})
