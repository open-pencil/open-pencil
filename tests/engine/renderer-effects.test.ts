import { describe, test, expect } from 'bun:test'

/**
 * These tests verify the renderer source code has the correct
 * rendering order and handles all effect types. Since CanvasKit
 * requires a browser/WASM environment, we validate the source structure.
 */

const rendererSource = await Bun.file(
  new URL('../../packages/core/src/renderer.ts', import.meta.url)
).text()

describe('Renderer effect ordering', () => {
  test('drop shadow renders before fills', () => {
    // In renderShape, "Effects (behind: drop shadow)" must come before "Fills"
    const behindIdx = rendererSource.indexOf("renderEffects(canvas, node, rect, hasRadius, 'behind')")
    const fillsIdx = rendererSource.indexOf('this.drawNodeFill(canvas, node, rect, hasRadius)')
    expect(behindIdx).toBeGreaterThan(-1)
    expect(fillsIdx).toBeGreaterThan(-1)
    expect(behindIdx).toBeLessThan(fillsIdx)
  })

  test('inner shadow and blur render after strokes', () => {
    const strokeIdx = rendererSource.indexOf('this.drawNodeStroke(canvas, node, rect, hasRadius)')
    const frontIdx = rendererSource.indexOf("renderEffects(canvas, node, rect, hasRadius, 'front')")
    expect(strokeIdx).toBeGreaterThan(-1)
    expect(frontIdx).toBeGreaterThan(-1)
    expect(strokeIdx).toBeLessThan(frontIdx)
  })
})

describe('Renderer handles all effect types', () => {
  test('handles DROP_SHADOW', () => {
    expect(rendererSource).toContain("effect.type === 'DROP_SHADOW'")
  })

  test('handles INNER_SHADOW', () => {
    expect(rendererSource).toContain("effect.type === 'INNER_SHADOW'")
  })

  test('handles LAYER_BLUR', () => {
    expect(rendererSource).toContain("e.type === 'LAYER_BLUR'")
  })

  test('handles BACKGROUND_BLUR', () => {
    expect(rendererSource).toContain("effect.type === 'BACKGROUND_BLUR'")
  })

  test('handles FOREGROUND_BLUR', () => {
    expect(rendererSource).toContain("effect.type === 'FOREGROUND_BLUR'")
  })
})

describe('Shadow spread support', () => {
  test('drop shadow uses spread for shape expansion', () => {
    const dropShadowSection = rendererSource.slice(
      rendererSource.indexOf("effect.type === 'DROP_SHADOW'"),
      rendererSource.indexOf("effect.type === 'DROP_SHADOW'") + 2000
    )
    expect(dropShadowSection).toContain('effect.spread')
    expect(dropShadowSection).toContain('makeRRectWithSpread')
    expect(dropShadowSection).toContain('MakeDropShadowOnly')
  })

  test('inner shadow uses spread for cutout contraction', () => {
    const innerShadowSection = rendererSource.slice(
      rendererSource.indexOf("effect.type === 'INNER_SHADOW'"),
      rendererSource.indexOf("effect.type === 'INNER_SHADOW'") + 3000
    )
    expect(innerShadowSection).toContain('effect.spread')
  })

  test('makeRRectWithSpread helper exists', () => {
    expect(rendererSource).toContain('private makeRRectWithSpread')
  })

  test('makeRRectWithOffset helper exists', () => {
    expect(rendererSource).toContain('private makeRRectWithOffset')
  })
})

describe('Text shadow renders on glyphs, not bounding box', () => {
  test('drop shadow has TEXT-specific branch', () => {
    const dropShadowBlock = rendererSource.slice(
      rendererSource.indexOf("effect.type === 'DROP_SHADOW'"),
      rendererSource.indexOf("effect.type === 'DROP_SHADOW'") + 2000
    )
    expect(dropShadowBlock).toContain("node.type === 'TEXT'")
    expect(dropShadowBlock).toContain('renderText')
    expect(dropShadowBlock).toContain('MakeDropShadowOnly')
  })

  test('inner shadow has TEXT-specific branch', () => {
    const innerShadowBlock = rendererSource.slice(
      rendererSource.indexOf("effect.type === 'INNER_SHADOW'"),
      rendererSource.indexOf("effect.type === 'INNER_SHADOW'") + 1500
    )
    expect(innerShadowBlock).toContain("node.type === 'TEXT'")
    expect(innerShadowBlock).toContain('renderText')
  })
})

describe('Blur effects use saveLayer pattern', () => {
  test('layer blur wraps node content in a blurred saveLayer', () => {
    expect(rendererSource).toContain("e.type === 'LAYER_BLUR'")
    // Applied at the renderNode level, not in renderEffects
    const layerBlurIdx = rendererSource.indexOf("e.type === 'LAYER_BLUR'")
    const layerBlurSection = rendererSource.slice(layerBlurIdx - 200, layerBlurIdx + 300)
    expect(layerBlurSection).toContain('MakeBlur')
    expect(layerBlurSection).toContain('saveLayer')
  })

  test('background blur clips to node shape before blurring', () => {
    const bgBlurIdx = rendererSource.indexOf("effect.type === 'BACKGROUND_BLUR'")
    const bgBlurSection = rendererSource.slice(bgBlurIdx, bgBlurIdx + 800)
    expect(bgBlurSection).toContain('clipNodeShape')
    expect(bgBlurSection).toContain('MakeBlur')
    expect(bgBlurSection).toContain('saveLayer')
  })

  test('foreground blur clips to node shape before blurring', () => {
    const fgBlurIdx = rendererSource.indexOf("effect.type === 'FOREGROUND_BLUR'")
    const fgBlurSection = rendererSource.slice(fgBlurIdx, fgBlurIdx + 800)
    expect(fgBlurSection).toContain('clipNodeShape')
    expect(fgBlurSection).toContain('MakeBlur')
    expect(fgBlurSection).toContain('saveLayer')
  })
})
