import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetupWithClear('/?test')
const MOCK_SVG = readFileSync(
  join(process.cwd(), 'tests/fixtures/vectorize/euro_shield.recraft.svg'),
  'utf8'
)

async function rightClickSelected(): Promise<void> {
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  const point = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store || store.state.selectedIds.size !== 1) return null
    const node = store.graph.getNode([...store.state.selectedIds][0])
    if (!node) return null
    return {
      x: (node.x + node.width / 2) * store.state.zoom + store.state.panX,
      y: (node.y + node.height / 2) * store.state.zoom + store.state.panY
    }
  })
  const selectedPoint = expectDefined(point, 'selected node screen point')
  await editor.page.mouse.click(box.x + selectedPoint.x, box.y + selectedPoint.y, {
    button: 'right'
  })
}

async function createImageNode(): Promise<string> {
  return editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const imageCanvas = document.createElement('canvas')
    imageCanvas.width = 120
    imageCanvas.height = 80
    const context = imageCanvas.getContext('2d')
    if (!context) throw new Error('Cannot create image fixture canvas')
    context.fillStyle = '#4488cc'
    context.fillRect(0, 0, 120, 80)
    const blob = await new Promise<Blob>((resolve, reject) => {
      imageCanvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('toBlob failed'))
      }, 'image/png')
    })
    const hash = store.storeImage(new Uint8Array(await blob.arrayBuffer()))
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      name: 'Vectorize Target',
      x: 180,
      y: 180,
      width: 120,
      height: 80,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })
    store.select([node.id])
    store.zoomToSelection()
    store.requestRender()
    return node.id
  })
}

test.beforeAll(async () => {
  await editor.page.route('**/external.api.recraft.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ image: { url: 'https://cdn.recraft.ai/mock.svg' } })
    })
  })
  await editor.page.route('https://cdn.recraft.ai/mock.svg', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: MOCK_SVG })
  })
})

test('Convert to vector appears only for a single image node', async () => {
  await createImageNode()
  await editor.canvas.waitForRender()
  await rightClickSelected()
  await expect(editor.page.getByTestId('context-vectorize')).toBeVisible()
  await editor.page.keyboard.press('Escape')

  await editor.canvas.drawRect(400, 400, 60, 60)
  await rightClickSelected()
  await expect(editor.page.getByTestId('context-vectorize')).toHaveCount(0)
  editor.canvas.assertNoErrors()
})

test('missing key opens Media settings and saves through the credential manager', async () => {
  const nodeId = await createImageNode()
  await editor.canvas.waitForRender()

  await rightClickSelected()
  await editor.page.getByTestId('context-vectorize').click()
  const section = editor.page.locator('[data-vectorize-settings]')
  await expect(section).toBeVisible()

  await section.getByTestId('provider-settings-api-key').fill('test-recraft-key')
  await editor.page.getByTestId('app-settings-done').click()
  await expect(editor.page.getByTestId('app-settings-dialog')).toHaveCount(0)
  expect(
    await editor.page.evaluate(
      (id) => window.openPencil?.getStore?.().graph.getNode(id)?.type,
      nodeId
    )
  ).toBe('RECTANGLE')
})

test('vectorize replaces an image with editable vectors and undo restores it', async () => {
  const nodeId = await createImageNode()
  await editor.canvas.waitForRender()

  await rightClickSelected()
  await editor.page.getByTestId('context-vectorize').click()
  await expect
    .poll(() =>
      editor.page.evaluate(
        (id) => window.openPencil?.getStore?.().graph.getNode(id)?.type ?? null,
        nodeId
      )
    )
    .toBeNull()

  const replacement = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store || store.state.selectedIds.size !== 1) return null
    const frameId = [...store.state.selectedIds][0]
    const frame = store.graph.getNode(frameId)
    if (!frame) return null
    return {
      frameId,
      type: frame.type,
      childTypes: frame.childIds.map((id) => store.graph.getNode(id)?.type)
    }
  })
  expect(replacement?.type).toBe('FRAME')
  expect(replacement?.childTypes.filter((type) => type === 'VECTOR').length).toBeGreaterThan(1)

  await editor.canvas.undo()
  await editor.canvas.waitForRender()
  expect(
    await editor.page.evaluate(
      (id) => window.openPencil?.getStore?.().graph.getNode(id)?.type,
      nodeId
    )
  ).toBe('RECTANGLE')
  editor.canvas.assertNoErrors()
})
