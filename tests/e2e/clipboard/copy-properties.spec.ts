import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetup()

const SOURCE = { x: 100, y: 150, width: 120, height: 80 }
const TARGET = { x: 400, y: 150, width: 120, height: 80 }

test.beforeAll(async () => {
  await editor.page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
})

function centre(rect: typeof SOURCE) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

async function drawRects() {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(SOURCE.x, SOURCE.y, SOURCE.width, SOURCE.height)
  const sourceId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const [id] = store.state.selectedIds
    if (!id) throw new Error('The drawn rectangle was not selected')
    store.updateNode(id, { cornerRadius: 12, opacity: 0.5 })
    return id
  })
  await editor.canvas.drawRect(TARGET.x, TARGET.y, TARGET.width, TARGET.height)
  await editor.canvas.waitForRender()
  return sourceId
}

async function selectAt(rect: typeof SOURCE) {
  const { x, y } = centre(rect)
  await editor.canvas.click(x, y)
  await editor.canvas.waitForRender()
}

function selectedLook() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const [id] = store.state.selectedIds
    const node = id ? store.graph.getNode(id) : undefined
    return node ? { id, cornerRadius: node.cornerRadius, opacity: node.opacity } : null
  })
}

function layerCount() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })
}

test('Alt+Cmd+C then Alt+Cmd+V moves the look of one layer to another, in one undo step', async () => {
  const sourceId = await drawRects()
  const before = expectDefined(await selectedLook(), 'target look')
  expect(before.cornerRadius).toBe(0)

  await selectAt(SOURCE)
  expect((await selectedLook())?.id).toBe(sourceId)
  await editor.page.keyboard.press('ControlOrMeta+Alt+KeyC')
  await expect(editor.page.getByText('Copied properties.')).toBeVisible()

  await selectAt(TARGET)
  await editor.page.keyboard.press('ControlOrMeta+Alt+KeyV')
  await expect.poll(selectedLook).toEqual({ id: before.id, cornerRadius: 12, opacity: 0.5 })

  // Paste skips what Copy properties wrote, as in Figma.
  const layers = await layerCount()
  await editor.page.keyboard.press('ControlOrMeta+KeyV')
  await editor.canvas.waitForRender()
  expect(await layerCount()).toBe(layers)

  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  await editor.canvas.waitForRender()
  expect(await selectedLook()).toEqual(before)
})

test('Paste properties reads an ordinary copy of a layer', async () => {
  await drawRects()
  await selectAt(SOURCE)
  await editor.page.keyboard.press('ControlOrMeta+KeyC')
  await selectAt(TARGET)
  await editor.page.keyboard.press('ControlOrMeta+Alt+KeyV')
  await expect.poll(selectedLook).toMatchObject({ cornerRadius: 12, opacity: 0.5 })
})

test('the Copy/Paste as menu copies and pastes properties', async () => {
  await drawRects()
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  const fromMenu = async (rect: typeof SOURCE, testId: string) => {
    const { x, y } = centre(rect)
    await editor.page.mouse.click(box.x + x, box.y + y, { button: 'right' })
    await editor.page.getByTestId('context-copy-paste-as').click({ force: true })
    await editor.page.getByTestId(testId).click()
  }

  await fromMenu(SOURCE, 'context-copy-properties')
  await fromMenu(TARGET, 'context-paste-properties')
  await expect.poll(selectedLook).toMatchObject({ cornerRadius: 12, opacity: 0.5 })
})
