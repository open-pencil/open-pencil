import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

const render = ALL_TOOLS.find((tool) => tool.name === 'render')
if (!render) throw new Error('No render tool')

describe('render', () => {
  test('loads the fonts its text names, then lays the text out in them', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const loaded: string[] = []
    figma.loadFontAsync = async (font) => {
      // Layout reads the text again once its font is in, so the text exists by then.
      const texts = [...graph.getAllNodes()].filter((node) => node.type === 'TEXT').length
      loaded.push(`${font.family} ${font.style}: ${texts} texts`)
    }

    await render.execute(figma, {
      jsx: '<Frame><Text font="Figma Hand" size={48}>Hello</Text><Sticky typeface="scribbled">Note</Sticky></Frame>'
    })

    expect(loaded.sort()).toEqual(['Figma Hand Regular: 3 texts', 'Inter Medium: 3 texts'])
  })
})
