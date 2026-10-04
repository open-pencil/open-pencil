import { expect, test } from 'bun:test'

import { createEditor, graphFromPageSnapshot } from '@open-pencil/core/editor'
import { diffPageLayersJSX } from '@open-pencil/core/tools'

import { expectDefined } from '#core-tests/helpers/assert'

test('reports top-level layers changed deep in their subtree, added, or removed', () => {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Card', width: 120, height: 80 })
  const label = editor.graph.createNode('TEXT', card.id, { name: 'Label', text: 'Hello' })
  const other = editor.graph.createNode('RECTANGLE', pageId, { name: 'Other', x: 300 })
  editor.graph.createNode('RECTANGLE', pageId, { name: 'Untouched', x: 600 })
  const before = expectDefined(
    graphFromPageSnapshot(editor.graph, editor.snapshotPage(pageId)),
    'before'
  )

  editor.graph.updateNode(label.id, { text: 'Hi' })
  const added = editor.graph.createNode('ELLIPSE', pageId, { name: 'Badge' })
  editor.graph.deleteNode(other.id)

  const changes = diffPageLayersJSX(before, editor.graph, pageId)
  expect(changes.map((change) => change.id)).toEqual([card.id, added.id, other.id])
  const [edited, created, removed] = changes
  expect(edited?.patch).toMatch(/^-.*Hello/m)
  expect(edited?.patch).toMatch(/^\+.*Hi/m)
  expect(created?.before).toBe('')
  expect(removed?.after).toBe('')
  expect(diffPageLayersJSX(editor.graph, editor.graph, pageId)).toEqual([])
})
