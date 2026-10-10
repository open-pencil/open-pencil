import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Figma's plugin API takes a page background as a paint with an RGB colour and optional opacity
// and visibility, as for fills.
describe('page backgrounds in the plugin API', () => {
  test('a background takes an RGB colour without alpha', () => {
    const figma = new FigmaAPI(new SceneGraph())
    // As an eval script written for Figma sets it; the typings here require alpha.
    Reflect.set(figma.currentPage, 'backgrounds', [
      { type: 'SOLID', color: { r: 30 / 255, g: 30 / 255, b: 30 / 255 } }
    ])
    const [background] = figma.currentPage.backgrounds
    expect(background).toMatchObject({ type: 'SOLID', opacity: 1, visible: true })
    expect(background?.color.r).toBeCloseTo(30 / 255, 6)
  })
})
