import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('setting a frame’s child order', () => {
  test('moves the children in one undo step, past a read-only library layer that stays', () => {
    const editor = createEditor()
    try {
      const { graph } = editor
      const frame = graph.createNode('FRAME', editor.state.currentPageId, { layoutMode: 'HORIZONTAL' })
      const a = graph.createNode('RECTANGLE', frame.id, { name: 'A', width: 40, height: 40 })
      const b = graph.createNode('RECTANGLE', frame.id, { name: 'B', width: 40, height: 40 })
      const remote = graph.createNode('COMPONENT', frame.id, {
        name: 'Remote',
        width: 40,
        height: 40,
        librarySource: {
          identity: { libraryId: 'design-system', assetKey: 'badge', revisionId: 'r1' },
          sourceNodeId: 'source',
          readOnly: true
        }
      })
      const order = () => frame.childIds.map((id) => graph.getNode(id)?.name).join('')
      editor.setChildOrder(frame.id, [b.id, a.id, remote.id])
      expect(order()).toBe('BARemote')
      editor.undoAction()
      expect(order()).toBe('ABRemote')
      editor.redoAction()
      expect(order()).toBe('BARemote')
      expect(() => editor.setChildOrder(frame.id, [remote.id, b.id, a.id])).toThrow()
    } finally {
      editor.dispose()
    }
  })
})
