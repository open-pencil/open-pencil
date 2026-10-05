import { expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '#fig-tests/helpers/fig-fixtures'

import { createFigDocumentSession } from '@open-pencil/fig'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

// Imported nodes must keep the shape every node is created with: a key outside it turns each
// node into a JavaScriptCore dictionary, which made opening large files in WebKit take about a
// fifth more memory.
test('imported nodes carry exactly the default scene node fields', () => {
  const session = createFigDocumentSession(readFixtureArrayBuffer('gold-preview.fig'))
  for (const page of session.pages) if (!page.internalOnly) session.loadPage(page.id)
  const fields = Object.keys(createDefaultNode(() => 'node', 'FRAME')).sort()
  const shapes = new Map<string, string>()
  for (const node of session.graph.nodes.values()) {
    const keys = Object.keys(node).sort().join(',')
    if (!shapes.has(keys)) shapes.set(keys, node.id)
  }
  expect([...shapes.keys()].map((keys) => keys.split(','))).toEqual([fields])
})
