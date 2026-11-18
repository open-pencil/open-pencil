import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test'

import { CanvasPointer } from './canvas/pointer'

const FIGMA_CDP_PORT = 9222

export class FigmaHelper extends CanvasPointer {
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

  async waitForRender() {
    await this.page.waitForTimeout(500)
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
