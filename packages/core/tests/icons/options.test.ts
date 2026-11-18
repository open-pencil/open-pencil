import { describe, expect, test } from 'bun:test'

import { designJSXRenderer } from '@open-pencil/core/design-jsx'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { parseIconName, type IconProvider } from '@open-pencil/core/icons'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'
import { readIcon, type IconOptions } from '@open-pencil/scene-graph/icons'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

import { graphOf } from '#core/figma-api/graph'
import { buildIconData } from '#core/icons/artwork'
import { iconOptionApplies, resolveIconOptions } from '#core/icons/options'
import type { IconOption } from '#core/icons/types'

const OPTIONS = [
  { key: 'wght', name: 'Weight', min: 100, max: 700, default: 400, step: 1 },
  { key: 'mode', name: 'Mode', values: ['plain', 'palette'], default: 'plain' },
  {
    key: 'accent',
    name: 'Accent',
    color: true,
    default: '#007AFF',
    when: { key: 'mode', value: 'palette' }
  }
] as const satisfies readonly IconOption[]

/** A set drawn from its own source, which records the options each icon is drawn with. */
function recordingProvider() {
  const asked: (IconOptions | undefined)[] = []
  const provider: IconProvider = {
    search: async () => ({ icons: [], total: 0, collections: {} }),
    collections: async () => [],
    browse: async () => [],
    previews: async () => new Map(),
    async icons(names, size, options) {
      asked.push(options)
      return new Map(
        names.flatMap((name) => {
          const parsed = parseIconName(name)
          if (!parsed) return []
          const icon = buildIconData(
            { body: '<path fill="currentColor" d="M2 2h20v20H2z"/>', width: 24, height: 24 },
            parsed.prefix,
            parsed.iconName,
            size
          )
          return [[name, { ...icon, options: resolveIconOptions(OPTIONS, options) }]]
        })
      )
    }
  }
  return { provider, asked }
}

describe('icon options', () => {
  test('resolve each option within what it takes, and only while it applies', () => {
    expect(resolveIconOptions(OPTIONS, { wght: 900, mode: 'sideways', accent: '#ff0000' })).toEqual(
      { wght: 700, mode: 'plain' }
    )
    expect(resolveIconOptions(OPTIONS, { mode: 'palette', accent: '#ff0000' })).toEqual({
      wght: 400,
      mode: 'palette',
      accent: '#FF0000'
    })
    expect(resolveIconOptions(OPTIONS, { mode: 'palette', accent: 'not a color' })).toMatchObject({
      accent: '#007AFF'
    })
    expect(iconOptionApplies(OPTIONS[2], { mode: 'plain' })).toBe(false)
  })

  test('insert_icon draws its icons with the options given', async () => {
    const { provider, asked } = recordingProvider()
    const figma = new FigmaAPI(new SceneGraph())
    figma.icons = provider
    const tool = ALL_TOOLS.find((def) => def.name === 'insert_icon')
    if (!tool) throw new Error('No insert_icon tool')
    const result = await tool.execute(figma, { name: 'test:square', options: { wght: 600 } })
    expect(asked).toEqual([{ wght: 600 }])
    const id = result && typeof result === 'object' && 'id' in result ? String(result.id) : ''
    expect(readIcon(getNodeOrThrow(graphOf(figma), id))?.options).toEqual({
      wght: 600,
      mode: 'plain'
    })
  })

  test('<Icon options> draws the icon with them, and rejects options that are not a map', async () => {
    const { provider, asked } = recordingProvider()
    const { renderJSX } = designJSXRenderer(provider)
    const graph = new SceneGraph()
    const [root] = await renderJSX(
      graph,
      '<Icon name="test:square" size={32} options={{ wght: 300, mode: "palette" }} />'
    )
    expect(asked).toEqual([{ wght: 300, mode: 'palette' }])
    expect(readIcon(getNodeOrThrow(graph, root.id))?.options).toEqual({
      wght: 300,
      mode: 'palette',
      accent: '#007AFF'
    })
    await expect(
      renderJSX(new SceneGraph(), '<Icon name="test:square" options="bold" />')
    ).rejects.toThrow('<Icon> options')
  })
})
