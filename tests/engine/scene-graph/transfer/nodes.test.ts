import { expect, test } from 'bun:test'

import {
  prepareNodeTransfer,
  SceneGraph,
  type NodeTransferReferences
} from '@open-pencil/scene-graph'

const references = (): NodeTransferReferences => ({
  nodes: new Map([['component', 'new-component']]),
  variables: new Map([['token', 'new-token']]),
  collections: new Map([['set', 'new-set']]),
  modes: new Map([['mode', 'new-mode']]),
  styles: new Map([['style', 'new-style']]),
  properties: new Map([
    ['swap', 'new-swap'],
    ['text', 'new-text']
  ]),
  propertyTypes: new Map([
    ['swap', 'INSTANCE_SWAP'],
    ['text', 'TEXT']
  ])
})

test('node preparation remaps typed runtime references but preserves source identities and text', () => {
  const graph = new SceneGraph()
  const node = graph.createNode('INSTANCE', graph.getPages()[0].id, {
    componentId: 'component',
    text: 'component',
    fillStyleId: 'style',
    boundVariables: { paddingLeft: 'token' },
    variableModes: { set: 'mode' },
    componentPropertyAssignments: { swap: 'component', text: 'component' },
    componentPropertyDefinitions: [
      { id: 'swap', name: 'Swap', type: 'INSTANCE_SWAP', defaultValue: 'component' }
    ]
  })
  node.source.id = 'component'
  const before = structuredClone(node)
  const result = prepareNodeTransfer(node, references())
  expect(result.componentId).toBe('new-component')
  expect(result.text).toBe('component')
  expect(result.source?.id).toBe('component')
  expect(result.fillStyleId).toBe('new-style')
  expect(result.boundVariables).toEqual({ paddingLeft: 'new-token' })
  expect(result.variableModes).toEqual({ 'new-set': 'new-mode' })
  expect(result.componentPropertyAssignments).toEqual({
    'new-swap': 'new-component',
    'new-text': 'component'
  })
  expect(result.componentPropertyDefinitions?.[0].defaultValue).toBe('new-component')
  expect(node).toEqual(before)
  expect(result.source).not.toBe(node.source)
})

test('node preparation fails on missing runtime references before destination mutation', () => {
  const graph = new SceneGraph()
  const node = graph.createNode('INSTANCE', graph.getPages()[0].id, { componentId: 'missing' })
  expect(() => prepareNodeTransfer(node, references())).toThrow('Missing node transfer mapping')
})
