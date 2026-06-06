import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetupWithClear('/?test')

/** Real Recraft output shape: viewBox user units differ from width/height attrs. */
const MOCK_SVG = readFileSync(
  join(process.cwd(), 'tests/fixtures/vectorize/euro_shield.recraft.svg'),
  'utf8'
)

test.beforeAll(async () => {
  await editor.page.route('**/external.api.recraft.ai/**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ image: { url: 'https://example.com/mock.svg' } })
      })
      return
    }
    await route.continue()
  })
  await editor.page.route('https://example.com/mock.svg', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: MOCK_SVG })
  })
})

async function rightClick(x: number, y: number) {
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.click(box.x + x, box.y + y, { button: 'right' })
}

async function createImageNode() {
  return editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const imageCanvas = document.createElement('canvas')
    imageCanvas.width = 120
    imageCanvas.height = 80
    const ctx = imageCanvas.getContext('2d')
    if (!ctx) throw new Error('Cannot create image fixture canvas')
    ctx.fillStyle = '#4488cc'
    ctx.fillRect(0, 0, 120, 80)
    const blob = await new Promise<Blob>((resolve, reject) => {
      imageCanvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('toBlob failed'))
      }, 'image/png')
    })
    const hash = store.storeImage(new Uint8Array(await blob.arrayBuffer()))
    const pageId = store.state.currentPageId
    const node = store.graph.createNode('RECTANGLE', pageId, {
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
    store.requestRender()
    return node.id
  })
}

async function setRecraftKey() {
  await editor.page.evaluate(
    "localStorage.setItem('open-pencil:recraft-api-key', 'test-recraft-key'); localStorage.setItem('open-pencil:vectorize-provider', 'recraft')"
  )
  await editor.page.reload()
  await editor.canvas.waitForInit()
}

test('Convert to Vector appears only for a single image node', async () => {
  await createImageNode()
  await editor.canvas.waitForRender()
  await rightClick(240, 220)
  await expect(editor.page.getByTestId('context-vectorize')).toBeVisible()
  await editor.page.keyboard.press('Escape')

  await editor.canvas.drawRect(400, 400, 60, 60)
  await rightClick(430, 430)
  await expect(editor.page.getByTestId('context-vectorize')).toHaveCount(0)
  editor.canvas.assertNoErrors()
})

test('vectorize replaces image with vectors and undo restores it', async () => {
  await setRecraftKey()
  const nodeId = await createImageNode()
  await editor.canvas.waitForRender()

  await rightClick(240, 220)
  await editor.page.getByTestId('context-vectorize').click()
  await editor.canvas.waitForRender()

  const nodeType = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    return store?.graph.getNode(id)?.type ?? null
  }, nodeId)
  expect(nodeType).not.toBe('RECTANGLE')

  const childBounds = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store || store.state.selectedIds.size !== 1) return null
    const frameId = [...store.state.selectedIds][0]
    const frame = store.graph.getNode(frameId)
    if (!frame || frame.type !== 'FRAME') return null
    const children = frame.childIds.map((id) => {
      const child = store.graph.getNode(id)
      return child ? { width: child.width, height: child.height, type: child.type } : null
    })
    return { frameWidth: frame.width, frameHeight: frame.height, children }
  })
  expect(childBounds).not.toBeNull()
  const vectors = (childBounds?.children ?? []).filter((child) => child?.type === 'VECTOR')
  expect(vectors.length).toBeGreaterThan(1)
  const smallest = vectors.reduce(
    (min, child) => Math.min(min, child?.width ?? min),
    childBounds?.frameWidth ?? Infinity
  )
  expect(smallest).toBeLessThan((childBounds?.frameWidth ?? 0) * 0.5)

  await editor.canvas.undo()
  await editor.canvas.waitForRender()

  const restored = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    return store?.graph.getNode(id)?.type ?? null
  }, nodeId)
  expect(restored).toBe('RECTANGLE')
  editor.canvas.assertNoErrors()
})

test('missing key shows error and leaves canvas unchanged', async () => {
  await editor.page.evaluate(
    "localStorage.removeItem('open-pencil:recraft-api-key'); localStorage.removeItem('open-pencil:fal-api-key')"
  )
  await editor.page.reload()
  await editor.canvas.waitForInit()
  const nodeId = await createImageNode()
  await editor.canvas.waitForRender()

  await rightClick(240, 220)
  await editor.page.getByTestId('context-vectorize').click()
  await editor.canvas.waitForRender()

  const nodeType = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    return store?.graph.getNode(id)?.type ?? null
  }, nodeId)
  expect(nodeType).toBe('RECTANGLE')
  await editor.page.getByTestId('toast-action').click()
  await expect(editor.page.getByTestId('provider-settings-recraft-key')).toBeVisible()
  await editor.page.getByTestId('provider-settings-vectorize-provider').click()
  await expect(editor.page.getByRole('option', { name: 'fal' })).toBeVisible()
  editor.canvas.assertNoErrors()
})

test('Recraft API key persists when typed in vectorize settings', async () => {
  await editor.page.evaluate("localStorage.removeItem('open-pencil:recraft-api-key')")
  await editor.page.reload()
  await editor.canvas.waitForInit()

  await editor.page.getByTestId('properties-tab-ai').click()
  await editor.page.getByTestId('provider-settings-trigger').click()
  const keyInput = editor.page.getByTestId('provider-settings-recraft-key')
  await keyInput.fill('sk-test-recraft-persist')
  await editor.page.getByTestId('provider-settings-done').click()
  await expect(editor.page.getByTestId('toast-item').getByText('Recraft key saved')).toBeVisible()

  const stored = await editor.page.evaluate("localStorage.getItem('open-pencil:recraft-api-key')")
  expect(stored).toBe('sk-test-recraft-persist')
  editor.canvas.assertNoErrors()
})
