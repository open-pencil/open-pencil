import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { getPageChildren } from '#tests/helpers/store'
import {
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId
} from '#tests/helpers/test-ids'

const editor = useEditorSetup()

test('shapes flyout opens', async () => {
  await editor.page.getByTestId(toolbarFlyoutTestId('RECTANGLE')).click()
  const rectangleItem = editor.page.getByTestId(toolbarFlyoutItemTestId('RECTANGLE'))
  const polygonItem = editor.page.getByTestId(toolbarFlyoutItemTestId('POLYGON'))

  await expect(polygonItem).toBeVisible()
  await expect(rectangleItem).toHaveAttribute('data-active', 'true')
  await expect(rectangleItem).toHaveAttribute('role', 'menuitemradio')
  await expect(rectangleItem).toHaveAttribute('aria-checked', 'true')
  await expect(rectangleItem.locator('[data-slot="flyout-item-indicator"] svg')).toHaveCount(1)
  await expect(polygonItem).not.toHaveAttribute('data-active', 'true')
  await expect(polygonItem).toHaveAttribute('aria-checked', 'false')
  editor.canvas.assertNoErrors()
})

test('Polygon tool creates POLYGON node', async () => {
  await editor.page.getByTestId(toolbarFlyoutItemTestId('POLYGON')).click()
  await expect(editor.page.getByTestId(toolbarToolTestId('POLYGON'))).toHaveAttribute(
    'data-active',
    'true'
  )
  await editor.canvas.drag(300, 200, 400, 300)
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  expect(children.some((n) => n.type === 'POLYGON')).toBe(true)
  editor.canvas.assertNoErrors()
})

test('Star tool creates STAR node', async () => {
  await editor.page.getByTestId(toolbarFlyoutTestId('RECTANGLE')).click()
  await editor.page.getByTestId(toolbarFlyoutItemTestId('STAR')).click()
  await editor.canvas.drag(150, 150, 250, 250)
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  expect(children.some((n) => n.type === 'STAR')).toBe(true)
  editor.canvas.assertNoErrors()
})

test('shape flyout remembers its selection independently of the active tool', async () => {
  await editor.canvas.pressKey('f')
  await expect(editor.page.getByTestId(toolbarToolTestId('STAR'))).not.toHaveAttribute(
    'data-active',
    'true'
  )

  await editor.page.getByTestId(toolbarFlyoutTestId('RECTANGLE')).click()
  const starItem = editor.page.getByTestId(toolbarFlyoutItemTestId('STAR'))
  const rectangleItem = editor.page.getByTestId(toolbarFlyoutItemTestId('RECTANGLE'))

  await expect(starItem).toHaveAttribute('data-active', 'true')
  await expect(starItem).toHaveAttribute('aria-checked', 'true')
  await expect(starItem.locator('[data-slot="flyout-item-indicator"] svg')).toHaveCount(1)
  await expect(rectangleItem).not.toHaveAttribute('data-active', 'true')
  await expect(rectangleItem).toHaveAttribute('aria-checked', 'false')

  await rectangleItem.hover()
  await expect(rectangleItem).toHaveAttribute('data-highlighted', '')
  await expect(starItem).toHaveAttribute('data-active', 'true')
  editor.canvas.assertNoErrors()
})

test('Pen creates VECTOR node with 3 vertices on Enter', async () => {
  await editor.canvas.pressKey('Escape')
  await editor.canvas.pressKey('p')
  await editor.canvas.click(100, 400)
  await editor.canvas.waitForRender()
  await editor.canvas.click(200, 400)
  await editor.canvas.waitForRender()
  await editor.canvas.click(200, 480)
  await editor.canvas.waitForRender()
  await editor.canvas.pressKey('Enter')
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  const vectors = children.filter((n) => n.type === 'VECTOR')
  expect(vectors.length).toBeGreaterThan(0)
  const last = vectors[vectors.length - 1]
  expect(last.vectorNetwork.vertices.length).toBe(3)
  editor.canvas.assertNoErrors()
})

test('Pen Escape with 2 vertices cancels path without creating node', async () => {
  const before = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR').length

  await editor.canvas.pressKey('p')
  await editor.canvas.click(350, 400)
  await editor.canvas.waitForRender()
  await editor.canvas.click(440, 400)
  await editor.canvas.waitForRender()
  await editor.canvas.pressKey('Escape')
  await editor.canvas.waitForRender()

  const after = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR').length
  expect(after).toBe(before)
  editor.canvas.assertNoErrors()
})

test('Pen close path creates VECTOR with closed region', async () => {
  const before = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR').length

  await editor.canvas.pressKey('p')
  await editor.canvas.click(500, 200)
  await editor.canvas.waitForRender()
  await editor.canvas.click(580, 200)
  await editor.canvas.waitForRender()
  await editor.canvas.click(540, 270)
  await editor.canvas.waitForRender()
  await editor.canvas.click(500, 200)
  await editor.canvas.waitForRender()

  const after = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR').length
  expect(after).toBeGreaterThan(before)

  const vectors = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR')
  const last = vectors[vectors.length - 1]
  expect(last.vectorNetwork.regions?.length).toBeGreaterThan(0)
  editor.canvas.assertNoErrors()
})

test('Frame flyout shows Frame and Section items', async () => {
  await editor.canvas.pressKey('f')
  const frameButton = editor.page.getByTestId(toolbarToolTestId('FRAME'))
  const frameOptions = editor.page.getByTestId(toolbarFlyoutTestId('FRAME'))

  await expect(frameButton).toHaveAttribute('data-active', 'true')
  await expect(frameOptions).not.toHaveAttribute('data-active', 'true')
  await expect(frameOptions).toHaveAttribute('data-state', 'closed')

  await frameOptions.click()
  await expect(frameOptions).toHaveAttribute('data-state', 'open')
  await expect(frameOptions).not.toHaveAttribute('data-active', 'true')
  const frameItem = editor.page.getByTestId(toolbarFlyoutItemTestId('FRAME'))
  await expect(frameItem).toBeVisible()
  await expect(frameItem).toHaveAttribute('data-active', 'true')
  await expect(frameItem.locator('[data-slot="flyout-item-indicator"] svg')).toHaveCount(1)
  const sectionItem = editor.page.getByTestId(toolbarFlyoutItemTestId('SECTION'))
  await expect(sectionItem).toBeVisible()
  await expect(sectionItem).not.toHaveAttribute('data-active', 'true')
  await expect(sectionItem.locator('[data-slot="flyout-item-indicator"] svg')).toHaveCount(0)

  await sectionItem.hover()
  await expect(sectionItem).toHaveAttribute('data-highlighted', '')
  await expect(frameItem).toHaveAttribute('data-active', 'true')
  editor.canvas.assertNoErrors()
})
