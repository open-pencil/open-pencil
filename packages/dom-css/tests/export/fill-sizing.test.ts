import { describe, expect, it } from 'bun:test'

import { sceneNodeToDesignDocument, type DesignNode } from '@open-pencil/dom-css/export'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

function styleOf(nodes: DesignNode[], name: string): Record<string, string> | undefined {
  for (const node of nodes) {
    if (node.type !== 'element') continue
    if (node.sourceSceneNode?.name === name) return node.inlineStyle
    const found = styleOf(node.children, name)
    if (found) return found
  }
  return undefined
}

function exportParent(layout: Partial<SceneNode>, children: Partial<SceneNode>[]) {
  const graph = new SceneGraph()
  const parent = graph.createNode('FRAME', graph.getPages()[0].id, {
    name: 'Parent',
    width: 300,
    height: 200,
    ...layout
  })
  for (const child of children) graph.createNode('FRAME', parent.id, child)
  return sceneNodeToDesignDocument(graph, parent.id).children
}

describe('fill sizing in DOM/CSS export', () => {
  it('leaves out the size a flex child stretches across, so align-self can stretch it', () => {
    const doc = exportParent({ layoutMode: 'HORIZONTAL' }, [
      { name: 'Tall', width: 40, height: 50, layoutAlignSelf: 'STRETCH' },
      { name: 'Wide', width: 40, height: 50, layoutGrow: 1 }
    ])

    expect(styleOf(doc, 'Tall')).toMatchObject({ width: '40px', 'align-self': 'stretch' })
    expect(styleOf(doc, 'Tall')?.height).toBeUndefined()
    // Along the row, fill is flex-grow and the size stays as its basis.
    expect(styleOf(doc, 'Wide')).toMatchObject({ width: '40px', height: '50px', 'flex-grow': '1' })
  })

  it('leaves out the size of each axis a grid child fills', () => {
    const doc = exportParent(
      {
        layoutMode: 'GRID',
        gridTemplateColumns: [
          { sizing: 'FR', value: 1 },
          { sizing: 'FR', value: 1 }
        ]
      },
      [
        { name: 'Wide', width: 40, height: 50, layoutGrow: 1 },
        { name: 'Tall', width: 40, height: 50, layoutAlignSelf: 'STRETCH' }
      ]
    )

    expect(styleOf(doc, 'Wide')?.width).toBeUndefined()
    expect(styleOf(doc, 'Wide')?.height).toBe('50px')
    expect(styleOf(doc, 'Tall')?.width).toBe('40px')
    expect(styleOf(doc, 'Tall')?.height).toBeUndefined()
  })
})
