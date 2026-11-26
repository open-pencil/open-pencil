import type { Locator, Page } from '@playwright/test'

import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

export type Theme = 'light' | 'dark'
/** Whose keyboard the app's menus show. */
export type Keyboard = 'mac' | 'other'

const SETTLE_MS = 500

export const settle = (page: Page) => page.waitForTimeout(SETTLE_MS)

async function loadApp(page: Page, origin: string) {
  await page.goto(`${origin}/?test`)
  // `getStore` throws until the editor has a document.
  await page.waitForFunction(() => {
    try {
      return Boolean(window.openPencil?.getStore?.())
    } catch {
      return false
    }
  })
  await settle(page)
}

/** Opens an empty document in `theme`. The setting applies to the canvas from the next load. */
export async function openApp(page: Page, origin: string, theme: Theme) {
  await loadApp(page, origin)
  await page.evaluate(
    (chosen) =>
      window.openPencil?.test?.automation?.('update_settings', {
        settings: { appearance: { theme: chosen } }
      }),
    theme
  )
  await settle(page)
  await loadApp(page, origin)
}

/** Replaces the page's layers with `jsx`, selects its outer frame, and centers it at `zoom`. */
export async function buildScene(page: Page, jsx: string, zoom = 1.4) {
  await page.evaluate(async (source) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    for (const layer of store.graph.getChildren(store.state.currentPageId)) {
      store.graph.deleteNode(layer.id)
    }
    await window.openPencil?.test?.automation?.('tool', {
      name: 'render',
      args: { jsx: source, x: 0, y: 0 }
    })
  }, jsx)
  await settle(page)
  await page.evaluate((scale) => {
    const store = window.openPencil?.getStore?.()
    const frame = store?.graph.getChildren(store.state.currentPageId).at(0)
    if (!store || !frame) throw new Error('The scene has no frame')
    store.select([frame.id])
    store.centerOn(frame.x + frame.width / 2, frame.y + frame.height / 2, scale)
  }, zoom)
  await settle(page)
}

/** The layer a path of names leads to, from the page down. */
function layerId(page: Page, path: string[]): Promise<string> {
  return page.evaluate((names) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    let id = store.state.currentPageId
    for (const name of names) {
      const layer = store.graph.getChildren(id).find((child) => child.name === name)
      if (!layer) throw new Error(`No layer ${name}`)
      id = layer.id
    }
    return id
  }, path)
}

/** A layer's box on screen. */
export async function layerBox(page: Page, path: string[]): Promise<Rect> {
  return page.evaluate(
    (id) => {
      const store = window.openPencil?.getStore?.()
      const canvas = document.querySelector('[data-test-id="canvas-element"]')
      const layer = store?.graph.getNode(id)
      if (!store || !canvas || !layer) throw new Error('The layer is not on the canvas')
      const { x, y } = store.graph.getAbsolutePosition(id)
      const { left, top } = canvas.getBoundingClientRect()
      const { zoom, panX, panY } = store.state
      return {
        x: left + x * zoom + panX,
        y: top + y * zoom + panY,
        width: layer.width * zoom,
        height: layer.height * zoom
      }
    },
    await layerId(page, path)
  )
}

export async function selectLayer(page: Page, path: string[]) {
  await page.evaluate(
    (id) => window.openPencil?.getStore?.()?.select([id]),
    await layerId(page, path)
  )
  await settle(page)
}

/** Clears the selection and moves the pointer off the layers, leaving them plain. */
export async function showPlain(page: Page) {
  await page.evaluate(() => window.openPencil?.getStore?.()?.clearSelection())
  await page.mouse.move(700, 120)
  await settle(page)
}

export async function boxOf(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${locator} is not on screen`)
  return box
}

/** A point of a box, by fractions of its size. */
export const within = (box: Rect, across: number, down: number): Vector => ({
  x: box.x + box.width * across,
  y: box.y + box.height * down
})
