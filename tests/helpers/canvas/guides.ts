import type { Page } from '@playwright/test'

import { RULER_SIZE } from '@open-pencil/core/constants'

import { expectDefined } from '#tests/helpers/assert'

export class CanvasGuideDriver {
  constructor(private readonly page: Page) {}

  async addFromRuler(axis: 'x' | 'y', x: number, y: number) {
    if (x <= RULER_SIZE || y <= RULER_SIZE) {
      throw new Error('Canvas guide destination must be outside the rulers')
    }

    const canvas = expectDefined(
      await this.page.getByTestId('canvas-element').boundingBox(),
      'canvas bounds'
    )
    const startX = axis === 'x' ? RULER_SIZE / 2 : x
    const startY = axis === 'x' ? y : RULER_SIZE / 2
    await this.page.mouse.move(canvas.x + startX, canvas.y + startY)
    await this.page.mouse.down()
    await this.page.mouse.move(canvas.x + x, canvas.y + y, { steps: 10 })
    await this.page.mouse.up()

    return { x: canvas.x + x, y: canvas.y + y }
  }
}
