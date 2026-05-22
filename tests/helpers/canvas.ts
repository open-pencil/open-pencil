import type { Page, Locator } from '@playwright/test'

export class CanvasHelper {
  readonly page: Page
  readonly canvas: Locator
  readonly errors: string[] = []
  private mcpProbeFailed = false

  constructor(page: Page) {
    this.page = page
    this.canvas = page.getByTestId('canvas-area')
    page.on('pageerror', (err) => this.errors.push(err.message))
    page.on('response', (response) => {
      if (response.status() === 429) {
        this.errors.push(`HTTP 429: ${response.url()}`)
      }
    })
    // Track MCP health probe request failures so we can suppress their
    // companion console errors. The MCP server may not be running during
    // E2E tests, producing CORS + ERR_FAILED console noise that is
    // infrastructure-only, not an app bug.
    page.on('requestfailed', (request) => {
      if (request.url().includes('127.0.0.1:7600')) {
        this.mcpProbeFailed = true
      }
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Suppress MCP health probe CORS errors (include the URL)
        if (text.includes('127.0.0.1:7600')) return
        // Suppress network errors from the MCP health probe — when the
        // probe request failed, companion console errors follow (CORS,
        // ERR_CONNECTION_REFUSED, ERR_FAILED, etc.). Only suppress when
        // we know a probe actually failed to avoid masking genuine errors.
        if (this.mcpProbeFailed && text.startsWith('Failed to load resource: net::ERR_')) return
        this.errors.push(text)
      }
    })
  }

  assertNoErrors() {
    if (this.errors.length > 0) {
      const messages = this.errors.join('\n')
      this.errors.length = 0
      throw new Error(`Browser errors:\n${messages}`)
    }
  }

  async waitForRender() {
    await this.page.evaluate(() => new Promise(requestAnimationFrame))
  }

  async waitForInit() {
    // CanvasKit init can stall after many sequential tests due to WebGL context
    // exhaustion. Try the standard wait first, then attempt a recovery reload,
    // and finally a hard navigation as last resort.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.waitForReadyState()
        return
      } catch {
        if (await this.page.isClosed()) {
          throw new Error('CanvasKit init failed: page was closed during wait')
        }
        if (attempt === 0) {
          // Recovery 1: reload the current page
          console.warn('CanvasKit init timed out — reloading page (attempt 1)')
          await this.page.reload({ waitUntil: 'load' })
        } else if (attempt === 1) {
          // Recovery 2: navigate away and back (fresher WebGL context)
          console.warn('CanvasKit init timed out — hard re-navigation (attempt 2)')
          await this.page.goto('about:blank', { waitUntil: 'commit' })
          await this.page.goto('/', { waitUntil: 'load' })
        }
      }
    }
    throw new Error('CanvasKit init failed after 3 attempts')
  }

  private async waitForReadyState() {
    await this.page
      .getByTestId('canvas-element')
      .and(this.page.locator('[data-ready="1"]'))
      .waitFor({ timeout: 45000 })
    await this.page.getByTestId('canvas-loading').waitFor({ state: 'hidden', timeout: 10000 })
    await this.page.locator('#loader').waitFor({ state: 'detached', timeout: 10000 })
  }

  async clearCanvas() {
    await this.selectAll()
    await this.pressKey('Backspace')
    await this.waitForRender()
  }

  async screenshotCanvas() {
    return this.canvas.screenshot()
  }

  private async canvasBounds() {
    const b = await this.canvas.boundingBox()
    if (!b) throw new Error('Canvas has no bounding box — is it visible?')
    return b
  }

  async click(canvasX: number, canvasY: number) {
    const box = await this.canvasBounds()
    await this.page.mouse.click(box.x + canvasX, box.y + canvasY)
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number, steps = 10) {
    const box = await this.canvasBounds()
    await this.page.mouse.move(box.x + fromX, box.y + fromY)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + toX, box.y + toY, { steps })
    await this.page.mouse.up()
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key)
  }

  async drawRect(x: number, y: number, width: number, height: number) {
    await this.pressKey('r')
    await this.drag(x, y, x + width, y + height)
    await this.waitForRender()
  }

  async drawEllipse(x: number, y: number, width: number, height: number) {
    await this.pressKey('o')
    await this.drag(x, y, x + width, y + height)
    await this.waitForRender()
  }

  async drawSection(x: number, y: number, width: number, height: number) {
    await this.pressKey('s')
    await this.drag(x, y, x + width, y + height)
    await this.waitForRender()
  }

  async selectTool(
    tool: 'select' | 'frame' | 'section' | 'rectangle' | 'ellipse' | 'text' | 'pen' | 'hand'
  ) {
    const keys: Record<string, string> = {
      select: 'v',
      frame: 'f',
      section: 's',
      rectangle: 'r',
      ellipse: 'o',
      text: 't',
      pen: 'p',
      hand: 'h'
    }
    await this.pressKey(keys[tool])
  }

  async deleteSelection() {
    await this.pressKey('Backspace')
    await this.waitForRender()
  }

  async undo() {
    await this.pressKey('Meta+z')
    await this.waitForRender()
  }

  async redo() {
    await this.pressKey('Meta+Shift+z')
    await this.waitForRender()
  }

  async selectAll() {
    await this.pressKey('Meta+a')
  }

  async duplicate() {
    await this.pressKey('Meta+d')
    await this.waitForRender()
  }

  async marquee(x1: number, y1: number, x2: number, y2: number, steps = 10) {
    const box = await this.canvasBounds()
    await this.page.mouse.move(box.x + x1, box.y + y1)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + x2, box.y + y2, { steps })
    await this.page.mouse.up()
    await this.waitForRender()
  }

  async hover(x: number, y: number) {
    const box = await this.canvasBounds()
    await this.page.mouse.move(box.x + x, box.y + y)
    await this.waitForRender()
  }

  /** Point `locator` at the outer ScrubInput container, not the inner `<input>`. */
  async dragScrubInput(locator: Locator, deltaX: number) {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (!box) throw new Error('dragScrubInput: element has no bounding box')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await this.page.mouse.move(cx, cy)
    await this.page.mouse.down()
    await this.page.mouse.move(cx + deltaX, cy, { steps: 10 })
    await this.page.mouse.up()
    await this.waitForRender()
  }

  async altDrag(fromX: number, fromY: number, toX: number, toY: number) {
    const box = await this.canvasBounds()
    await this.page.keyboard.down('Alt')
    await this.page.mouse.move(box.x + fromX, box.y + fromY)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + toX, box.y + toY, { steps: 10 })
    await this.page.mouse.up()
    await this.page.keyboard.up('Alt')
    await this.waitForRender()
  }

  async shiftDrag(fromX: number, fromY: number, toX: number, toY: number) {
    const box = await this.canvasBounds()
    await this.page.keyboard.down('Shift')
    await this.page.mouse.move(box.x + fromX, box.y + fromY)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + toX, box.y + toY, { steps: 10 })
    await this.page.mouse.up()
    await this.page.keyboard.up('Shift')
    await this.waitForRender()
  }

  async dblclick(x: number, y: number) {
    const box = await this.canvasBounds()
    await this.page.mouse.dblclick(box.x + x, box.y + y)
    await this.waitForRender()
  }

  /**
   * Configure renderer viewport (zoom, pan, DPR, page) for test scenarios.
   * Centralizes the renderer setup that was previously copy-pasted across
   * LOD, zoom/perf, and effect-lod E2E tests.
   */
  async setupRendererViewport(opts: {
    width: number
    height: number
    zoom: number
    centerX?: number
    centerY?: number
  }): Promise<void> {
    const { width, height, zoom, centerX = 0, centerY = 0 } = opts
    await this.page.evaluate(
      ({ width: w, height: h, zoom: z, cx, cy }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer
        if (!renderer) throw new Error('openPencil renderer not available')
        renderer.dpr = window.devicePixelRatio || 1
        renderer.viewportWidth = w
        renderer.viewportHeight = h
        renderer.zoom = z
        renderer.panX = w / 2 - cx * z
        renderer.panY = h / 2 - cy * z
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId
      },
      { width, height, zoom, cx: centerX, cy: centerY }
    )
  }
}

/** Check if a teardown error is safe to ignore (page closed, test ended, etc.) */
export function isIgnorableTeardownError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('Test ended') ||
    error.message.includes('net::ERR_ABORTED') ||
    error.message.includes('Target page, context or browser has been closed') ||
    error.message.includes('Execution context was destroyed')
  )
}

/** Clear all renderer caches and delete all nodes — called before page close. */
export function clearRendererCaches(): void {
  const store = window.openPencil?.getStore?.()
  if (!store) return
  const graph = store.graph
  const pageNode = graph.getNode(store.state.currentPageId)
  if (pageNode) {
    for (const childId of Array.from(pageNode.childIds)) {
      graph.deleteNode(childId)
    }
  }
  // Release all cached WebGL resources before page close
  const renderer = store.renderer
  renderer?.invalidateAllPictures?.()
  for (const cache of [
    renderer?.shaderCache,
    renderer?.nodePictureCache,
    renderer?.imageCache,
    renderer?.imageFilterCache,
    renderer?.maskFilterCache,
    renderer?.vectorPathCache,
    renderer?.fillGeometryCache,
    renderer?.strokeGeometryCache
  ]) {
    cache?.clear?.()
  }
}

/**
 * Clean up a CanvasHelper after a test: clear renderer caches,
 * navigate away to release WebGL contexts, then close the page.
 * Safe to call even if the page has already been closed.
 */
export async function cleanupCanvasTestPage(helper: CanvasHelper): Promise<void> {
  if (helper.page.isClosed()) return

  try {
    await helper.page.evaluate(clearRendererCaches)
  } catch (error) {
    if (!isIgnorableTeardownError(error)) throw error
  }

  // Navigate away to trigger WebGL context release, then pause briefly for GC
  if (helper.page.isClosed()) return

  try {
    await helper.page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 })
  } catch (error) {
    if (!isIgnorableTeardownError(error)) throw error
  }

  // Small delay to allow the browser's GPU process to release WebGL contexts
  await new Promise((resolve) => {
    setTimeout(() => resolve(), 500)
  })

  if (!helper.page.isClosed()) {
    try {
      await helper.page.close({ runBeforeUnload: false })
    } catch (error) {
      if (!isIgnorableTeardownError(error)) throw error
    }
  }
}
