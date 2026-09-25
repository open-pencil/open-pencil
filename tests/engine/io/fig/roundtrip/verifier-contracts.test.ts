import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { RAW_VERIFIERS, SCENE_VERIFIERS, type VerifierContext } from './helpers'

function referenceContext(a: string, b: string): VerifierContext {
  const aGraph = new SceneGraph()
  const bGraph = new SceneGraph()
  const aDefault = aGraph.createNode('COMPONENT', aGraph.getPages()[0].id)
  const bDefault = bGraph.createNode('COMPONENT', bGraph.getPages()[0].id)
  const definition = { id: 'property', name: 'Choice', type: 'INSTANCE_SWAP' }
  const context: VerifierContext = {
    a: [{ ...definition, defaultValue: aDefault.id, preferredValues: [a] }],
    b: [{ ...definition, defaultValue: bDefault.id, preferredValues: [b] }],
    key: 'componentPropertyDefinitions',
    path: 'component',
    aGraph,
    bGraph,
    aNodes: new Map([['default', aDefault]]),
    bNodes: new Map([['default', bDefault]]),
    aNodePaths: new Map([[aDefault.id, 'default']]),
    bNodePaths: new Map([[bDefault.id, 'default']]),
    aComponentPropertyDefinitions: new Map(),
    bComponentPropertyDefinitions: new Map(),
    errors: [],
    label: 'G0->G1',
    generation: 0,
    fixture: {
      file: 'synthetic',
      fileSize: 0,
      schemaSize: 0,
      thumbnailSize: 0,
      thumbnailWidth: 0,
      thumbnailHeight: 0,
      imageCount: 0,
      figKiwiVersion: 0
    }
  }
  return context
}

function comparePreferred(a: string, b: string): boolean {
  const context = referenceContext(a, b)
  const verifier = SCENE_VERIFIERS.get(context.key)
  if (!verifier) throw new Error('Missing definition verifier')
  return verifier(context)
}

test('raw letter-spacing comparison uses the saved unit and still rejects wrong spacing', () => {
  const context = referenceContext('asset', 'asset')
  const text = context.aGraph.createNode('TEXT', context.aGraph.getPages()[0].id, {
    fontSize: 20,
    letterSpacing: 0.1
  })
  context.aNodes.set(context.path, text)
  context.key = 'letterSpacing'
  context.b = { value: 0.5, units: 'PERCENT' }
  const verifier = RAW_VERIFIERS.get(context.key)
  if (!verifier) throw new Error('Missing letter-spacing verifier')
  expect(verifier(context)).toBe(true)
  expect(context.errors).toEqual([])
  context.b = { value: 0.5, units: 'PIXELS' }
  verifier(context)
  expect(context.errors).toHaveLength(1)
})

test('idempotent comparison ignores object key order without losing undefined values', () => {
  const context = referenceContext('asset', 'asset')
  context.generation = 1
  context.a = { value: 0.5, units: 'PERCENT' }
  context.b = { units: 'PERCENT', value: 0.5 }
  const verifier = RAW_VERIFIERS.get('letterSpacing')
  if (!verifier) throw new Error('Missing letter-spacing verifier')
  expect(verifier(context)).toBe(true)
  context.a = [undefined]
  context.b = [null]
  expect(verifier(context)).toBe(false)
})

test('one variable can bind multiple fields without hiding a missing field', () => {
  const context = referenceContext('asset', 'asset')
  const entry = (variableField: string) => ({
    variableField,
    variableData: { value: { alias: { assetRef: { key: 'radius', version: 'v1' } } } }
  })
  context.key = 'variableConsumptionMap'
  context.a = {
    entries: [entry('RECTANGLE_TOP_LEFT_CORNER_RADIUS'), entry('RECTANGLE_TOP_RIGHT_CORNER_RADIUS')]
  }
  context.b = structuredClone(context.a)
  const verifier = RAW_VERIFIERS.get(context.key)
  if (!verifier) throw new Error('Missing variable verifier')
  verifier(context)
  expect(context.errors).toEqual([])
  context.b = { entries: [entry('RECTANGLE_TOP_LEFT_CORNER_RADIUS')] }
  verifier(context)
  expect(context.errors).toHaveLength(1)
})

test('definition comparison preserves external preferred asset identity', () => {
  expect(comparePreferred('external-asset-key', 'external-asset-key')).toBe(true)
  expect(comparePreferred('external-asset-key', 'different-asset-key')).toBe(false)
  expect(comparePreferred('999:999', '999:999')).toBe(false)
})
