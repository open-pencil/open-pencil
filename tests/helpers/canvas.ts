import type { Page, Locator } from '@playwright/test'

export class CanvasHelper {
  readonly page: Page
  readonly canvas: Locator
  readonly errors: string[] = []

  constructor(page: Page) {
    this.page = page
    this.canvas = page.locator('canvas')
    page.on('pageerror', (err) => this.errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') this.errors.push(msg.text())
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
    await this.page.locator('canvas[data-ready="1"]').waitFor({ timeout: 30000 })
    await this.page.locator('[data-test-id="canvas-loading"]').waitFor({ state: 'hidden', timeout: 30000 })
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

  async drag(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    steps = 10
  ) {
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

  async selectTool(tool: 'select' | 'frame' | 'rectangle' | 'ellipse' | 'text' | 'pen' | 'hand') {
    const keys: Record<string, string> = {
      select: 'v',
      frame: 'f',
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

  /** Point `locator` at the outer ScrubInput container (`[data-test-id="scrub-input"]`), not the inner `<input>`. */
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
}
