import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { importSVG } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('import_svg', () => {
  test('loads the fonts its text uses before creating the text', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const loaded: Array<{ family: string; style: string; textsSoFar: number }> = []
    figma.loadFontAsync = async (font) => {
      const textsSoFar = [...graph.getAllNodes()].filter((node) => node.type === 'TEXT').length
      loaded.push({ ...font, textsSoFar })
    }

    await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 200 60"><text x="100" y="30" font-size="20" font-weight="700" text-anchor="middle">Bold <tspan font-style="italic">tilt</tspan></text></svg>'
    })

    expect(loaded).toEqual([
      { family: 'Inter', style: 'Bold', textsSoFar: 0 },
      { family: 'Inter', style: 'Bold Italic', textsSoFar: 0 }
    ])
  })
})
