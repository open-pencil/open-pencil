import type { Locator, Page } from '@playwright/test'

/**
 * Pointer and key input on a canvas, in coordinates from the canvas's top-left corner. The app's
 * canvas driver and the live Figma driver share it, so a gesture means the same in both.
 */
export abstract class CanvasPointer {
  abstract readonly page: Page
  abstract readonly canvas: Locator
  abstract waitForRender(): Promise<void>

  protected async canvasBounds() {
    const bounds = await this.canvas.boundingBox()
    if (!bounds) throw new Error('Canvas has no bounding box — is it visible?')
    return bounds
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

  /** A drag with `modifier` held from before the press until after the release. */
  async dragWith(modifier: string, fromX: number, fromY: number, toX: number, toY: number) {
    await this.page.keyboard.down(modifier)
    await this.drag(fromX, fromY, toX, toY)
    await this.page.keyboard.up(modifier)
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key)
  }
}
