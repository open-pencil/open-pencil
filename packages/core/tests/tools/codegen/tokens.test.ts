import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { designToTokens } from '#core/tools/codegen/tokens'

const run = (figma: FigmaAPI, args: Parameters<typeof designToTokens.execute>[1]) =>
  designToTokens.execute(figma, args)

function themeTokens() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const primitives = graph.createCollection('Primitives')
  const blue = graph.createVariable('Blue/500', 'COLOR', primitives.id, {
    r: 0.23,
    g: 0.51,
    b: 0.96,
    a: 1
  })
  const theme = graph.createCollection('Theme')
  graph.renameMode(theme.id, theme.defaultModeId, 'Light')
  graph.addMode(theme.id, 'dark', 'Dark')
  const primary = graph.createVariable('Primary', 'COLOR', theme.id, { aliasId: blue.id })
  primary.valuesByMode.dark = { r: 0.58, g: 0.77, b: 0.99, a: 1 }
  graph.createVariable('Gap', 'FLOAT', theme.id, 8)
  return figma
}

describe('design_to_tokens', () => {
  test('writes defaults, mode scopes, and aliases as references', async () => {
    const result = await run(themeTokens(), { format: 'css' })
    expect(result.output).toContain('--color-primary: var(--color-blue-500);')
    expect(result.output).toContain('[data-theme="dark"] {\n  --color-primary: #94C4FC;\n}')
    expect(result.tokenCount).toBe(3)
    expect(result.issues).toEqual([])
  })

  test('keeps references to tokens left out by a filter', async () => {
    const result = await run(themeTokens(), { format: 'css', collection: 'theme', type: 'COLOR' })
    expect(result.output).toContain('--color-primary: var(--color-blue-500);')
    expect(result.output).not.toContain('--color-blue-500:')
    expect(result.output).not.toContain('--gap')
    expect(result.tokenCount).toBe(1)
  })

  test('writes a Tailwind v4 theme with a variant per mode', async () => {
    const result = await run(themeTokens(), { format: 'tailwind' })
    expect(result.output).toStartWith('@theme {')
    expect(result.output).toContain(':root {\n  --gap: 8px;\n}')
    expect(result.output).toContain(
      '@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));'
    )
  })
})
