import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'

// Recorded in Figma desktop 126: Combine as variants from the canvas pads the set and outlines it;
// the plugin API's combineAsVariants wraps the components exactly.

function components(editor: ReturnType<typeof createEditor>) {
  const page = editor.state.currentPageId
  const a = editor.graph.createNode('COMPONENT', page, {
    name: 'v=a',
    x: 200,
    width: 60,
    height: 60
  })
  const b = editor.graph.createNode('COMPONENT', page, {
    name: 'v=b',
    x: 300,
    y: 50,
    width: 60,
    height: 60
  })
  return [a, b]
}

describe('combine as variants', () => {
  test('the canvas command pads the set by 20 and outlines it with a dashed purple stroke', () => {
    const editor = createEditor()
    try {
      const [a, b] = components(editor)
      editor.select([a.id, b.id])
      editor.createComponentSetFromComponents()
      const set = editor.graph.getNode(a.parentId ?? '')
      expect(set).toMatchObject({ type: 'COMPONENT_SET', x: 180, y: -20, width: 200, height: 150 })
      expect(set?.fills).toEqual([])
      expect(set?.cornerRadius).toBe(5)
      expect(set?.strokes[0]).toMatchObject({ weight: 1, align: 'INSIDE', dashPattern: [10, 5] })
      expect(editor.graph.getNode(a.id)).toMatchObject({ x: 20, y: 20 })
      expect(editor.graph.getNode(b.id)).toMatchObject({ x: 120, y: 70 })
    } finally {
      editor.dispose()
    }
  })

  test('the plugin API wraps the components exactly', () => {
    const editor = createEditor()
    try {
      const figma = new FigmaAPI(editor.graph)
      figma.currentPage = figma.wrapNode(editor.state.currentPageId)
      const a = figma.createComponent()
      a.name = 'v=a'
      a.resize(60, 60)
      a.x = 200
      const b = figma.createComponent()
      b.name = 'v=b'
      b.resize(60, 60)
      b.x = 300
      b.y = 50
      const set = figma.combineAsVariants([a, b], figma.currentPage)
      expect([set.x, set.y, set.width, set.height]).toEqual([200, 0, 160, 110])
      expect(set.fills).toEqual([])
      expect(set.strokes).toEqual([])
      expect(set.children.map((child) => [child.x, child.y])).toEqual([
        [0, 0],
        [100, 50]
      ])
    } finally {
      editor.dispose()
    }
  })
})
