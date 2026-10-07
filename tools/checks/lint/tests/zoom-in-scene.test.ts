import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-zoom-in-scene-drawing'
const rules = { [`open-pencil/${rule}`]: 'error' }
const SCENE = 'packages/core/src/canvas/scene.ts'

describe('no-zoom-in-scene-drawing', () => {
  test.each([
    'paint.setStrokeWidth(1 / r.zoom)',
    'const dash = [4 / renderer.zoom, 4 / renderer.zoom]',
    'const scale = effectRasterScale(() => 1 / r.zoom)'
  ])('rejects %s in scene drawing', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules, SCENE), rule).length).toBeGreaterThan(0)
  })

  test('rejects it in text drawing', async () => {
    const source = 'const width = 1 / r.zoom'
    expect(
      ruleDiagnostics(await lint(source, rules, 'packages/core/src/canvas/text/derived.ts'), rule)
    ).toHaveLength(1)
  })

  test.each([
    ['raster quality for effects', 'const scale = effectRasterScale(r.zoom * r.dpr)', SCENE],
    [
      'overlay drawing',
      'paint.setStrokeWidth(1 / r.zoom)',
      'packages/core/src/canvas/overlays/slots.ts'
    ],
    ['a computed property', "const value = settings['zoom']", SCENE]
  ])('accepts %s', async (_name, source, file) => {
    expect(ruleDiagnostics(await lint(source, rules, file), rule)).toHaveLength(0)
  })
})
