import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'

describe('pasting Mermaid text', () => {
  test('lays the flowchart out centred on the point, selected, as one undo entry', async () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    expect(await editor.pasteMermaid('flowchart TD\n  A[Start] --> B[End]', 500, 300)).toBe(true)

    const layers = editor.graph.getChildren(pageId)
    expect(layers.map((node) => node.type).sort()).toEqual([
      'CONNECTOR',
      'SHAPE_WITH_TEXT',
      'SHAPE_WITH_TEXT'
    ])
    const shapes = layers.filter((node) => node.type === 'SHAPE_WITH_TEXT')
    const bounds = getAxisAlignedBoundsInParent(shapes, pageId, editor.graph)
    expect(bounds.x + bounds.width / 2).toBeCloseTo(500, 0)
    expect(bounds.y + bounds.height / 2).toBeCloseTo(300, 0)
    expect(editor.state.selectedIds.size).toBe(3)
    expect(editor.undo.undoLabel).toBe('Paste Mermaid')

    editor.undoAction()
    expect(editor.graph.getChildren(pageId)).toHaveLength(0)
  })

  test('leaves text that is not a Mermaid flowchart to other paste handlers', async () => {
    const editor = createEditor()
    expect(await editor.pasteMermaid('graphical interfaces', 0, 0)).toBe(false)
    expect(await editor.pasteMermaid('sequenceDiagram\n  A->>B: hi', 0, 0)).toBe(false)
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(0)
  })
})
