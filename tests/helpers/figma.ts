import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test'

const FIGMA_CDP_PORT = 9222

export class FigmaHelper {
  private browser!: Browser
  private context!: BrowserContext
  page!: Page

  async connect() {
    this.browser = await chromium.connectOverCDP(`http://localhost:${FIGMA_CDP_PORT}`)
    const contexts = this.browser.contexts()
    if (contexts.length === 0) throw new Error('No Figma contexts found')
    this.context = contexts[0]

    const pages = this.context.pages()
    const editorPage = pages.find((p) => p.url().includes('figma.com/design'))
    if (!editorPage) {
      throw new Error(
        `No Figma editor page found. Open a file in Figma first.\nPages: ${pages.map((p) => p.url()).join(', ')}`
      )
    }
    this.page = editorPage
  }

  async disconnect() {
    await this.browser?.close()
  }

  get canvas() {
    return this.page.locator('canvas.gpu-view-content')
  }

  async screenshotCanvas() {
    return this.canvas.screenshot()
  }

  private async canvasBounds() {
    return this.canvas.boundingBox().then((b) => b!)
  }

  async waitForRender() {
    await this.page.waitForTimeout(500)
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
    await this.waitForRender()
    await this.drag(x, y, x + width, y + height)
    await this.waitForRender()
  }

  async selectAll() {
    await this.pressKey('Meta+a')
    await this.waitForRender()
  }

  async deleteSelection() {
    await this.selectAll()
    await this.pressKey('Backspace')
    await this.waitForRender()
  }
}
