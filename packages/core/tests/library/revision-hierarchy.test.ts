import { expect, test } from 'bun:test'

import {
  createLibraryRevision,
  deserializeLibraryRevision,
  serializeLibraryRevision
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

test('a stored library revision whose child lists form a cycle is repaired when read', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const button = graph.createNode('COMPONENT', page.id, { name: 'Button', componentKey: 'button' })
  graph.createNode('FRAME', button.id, { name: 'Label' })
  const revision = await createLibraryRevision({ libraryId: 'kit', name: 'Kit', graph })
  const stored = serializeLibraryRevision(revision)
  const corrupted = stored.graph.nodes.find(([, node]) => node.name === 'Label')
  if (!corrupted) throw new Error('Expected the label in the stored revision')
  const storedButton = stored.graph.nodes.find(([, node]) => node.name === 'Button')
  if (!storedButton) throw new Error('Expected the button in the stored revision')
  corrupted[1].childIds = [storedButton[0]]

  const restored = deserializeLibraryRevision(structuredClone(stored))
  const restoredLabel = [...restored.graph.getAllNodes()].find((node) => node.name === 'Label')

  expect(restoredLabel?.childIds).toEqual([])
  expect(restoredLabel && restored.graph.getNode(restoredLabel.parentId ?? '')?.name).toBe('Button')
})
