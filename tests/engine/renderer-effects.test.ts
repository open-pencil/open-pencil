import { describe, test, expect } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const rendererDir = new URL('../../packages/core/src/renderer/', import.meta.url).pathname
const files = await readdir(rendererDir)
const parts = await Promise.all(
  files.filter((f) => f.endsWith('.ts')).map((f) => Bun.file(join(rendererDir, f)).text())
)
const rendererSource = parts.join('\n')

describe('Renderer effect ordering', () => {
  test('drop shadow renders before fills', () => {
    const behindIdx = rendererSource.indexOf("renderEffects(canvas, node, rect, hasRadius, 'behind')")
    const fillsIdx = rendererSource.indexOf('drawNodeFill(canvas, node, rect, hasRadius)')
    expect(behindIdx).toBeGreaterThan(-1)
    expect(fillsIdx).toBeGreaterThan(-1)
    expect(behindIdx).toBeLessThan(fillsIdx)
  })

  test('inner shadow and blur render after strokes', () => {
    const strokeIdx = rendererSource.indexOf('drawStrokeWithAlign(canvas, node, rect, hasRadius, stroke.align)')
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
    expect(dropShadowSection).toContain('getCachedDropShadow')
  })

  test('inner shadow uses spread for cutout contraction', () => {
    const innerShadowSection = rendererSource.slice(
      rendererSource.indexOf("effect.type === 'INNER_SHADOW'"),
      rendererSource.indexOf("effect.type === 'INNER_SHADOW'") + 3000
    )
    expect(innerShadowSection).toContain('effect.spread')
  })

  test('makeRRectWithSpread helper exists', () => {
    expect(rendererSource).toContain('function makeRRectWithSpread')
  })

  test('makeRRectWithOffset helper exists', () => {
    expect(rendererSource).toContain('function makeRRectWithOffset')
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
    expect(dropShadowBlock).toContain('getCachedDropShadow')
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
    const layerBlurIdx = rendererSource.indexOf("e.type === 'LAYER_BLUR'")
    const layerBlurSection = rendererSource.slice(layerBlurIdx - 200, layerBlurIdx + 300)
    expect(layerBlurSection).toContain('getCachedBlur')
    expect(layerBlurSection).toContain('saveLayer')
  })

  test('background and foreground blur use applyClippedBlur', () => {
    expect(rendererSource).toContain("effect.type === 'BACKGROUND_BLUR'")
    expect(rendererSource).toContain("effect.type === 'FOREGROUND_BLUR'")
    expect(rendererSource).toContain('applyClippedBlur')
  })

  test('applyClippedBlur clips to node shape and uses saveLayer', () => {
    const idx = rendererSource.indexOf('function applyClippedBlur')
    const section = rendererSource.slice(idx, idx + 500)
    expect(section).toContain('clipNodeShape')
    expect(section).toContain('getCachedBlur')
    expect(section).toContain('saveLayer')
  })
})
