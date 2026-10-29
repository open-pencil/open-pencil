import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { importMermaid } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

const importedSchema = v.object({
  ids: v.array(v.string()),
  nodes: v.record(v.string(), v.string()),
  connectors: v.record(v.string(), v.string())
})

describe('import_mermaid', () => {
  test('returns the layer of every node and subgraph and the connector of every edge', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const result = v.parse(
      importedSchema,
      await importMermaid.execute(figma, {
        mermaid:
          'flowchart LR\n  subgraph S [Steps]\n    A[Plan] --> B[Build]\n  end\n  B --> C[Ship]'
      })
    )
    expect(Object.keys(result.nodes).sort()).toEqual(['A', 'B', 'C', 'S'])
    expect(graph.getNode(result.nodes.S ?? '')?.type).toBe('SECTION')
    expect(Object.keys(result.connectors)).toHaveLength(2)
    expect(result.ids.map((id) => graph.getNode(id)?.parentId)).toEqual(
      result.ids.map(() => figma.currentPage.id)
    )
  })

  test('places the diagram beside what the page already holds', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const existing = figma.createRectangle()
    existing.resize(300, 200)
    const result = v.parse(
      importedSchema,
      await importMermaid.execute(figma, { mermaid: 'graph TD\n  A --> B' })
    )
    const left = Math.min(...result.ids.map((id) => graph.getNode(id)?.x ?? 0))
    expect(left).toBeGreaterThan(300)
  })

  test('reports what Mermaid cannot read', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(await importMermaid.execute(figma, { mermaid: 'pie\n "a": 1' })).toEqual({
      error: 'Only Mermaid flowcharts, starting with `flowchart` or `graph`, are supported'
    })
    const broken = await importMermaid.execute(figma, { mermaid: 'flowchart LR\n  A --> ' })
    expect(broken).toMatchObject({ error: expect.stringContaining('Parse error') })
  })
})
