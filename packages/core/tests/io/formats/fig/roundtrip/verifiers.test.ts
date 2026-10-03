import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { RAW_VERIFIERS, SCENE_VERIFIERS, type VerifierContext } from './helpers'

function context(a: unknown, b: unknown, generation = 0): VerifierContext {
  return {
    a,
    b,
    generation,
    key: '',
    path: '',
    label: 'verifier regression',
    aGraph: new SceneGraph(),
    bGraph: new SceneGraph(),
    aNodes: new Map(),
    bNodes: new Map(),
    aNodePaths: new Map(),
    bNodePaths: new Map(),
    aComponentPropertyDefinitions: new Map(),
    bComponentPropertyDefinitions: new Map(),
    errors: [],
    fixture: {
      file: '',
      fileSize: 0,
      nodeCount: 0,
      nodeTypes: {},
      schemaSize: 0,
      thumbnailSize: 0,
      thumbnailWidth: 0,
      thumbnailHeight: 0,
      imageCount: 0,
      figKiwiVersion: 0,
      g1ExportSize: 0,
      g2ExportSize: 0
    }
  }
}

test('alignment normalization accepts only default LEFT on the first round trip', () => {
  const verify = RAW_VERIFIERS.get('textAlignHorizontal')
  expect(verify).toBeDefined()
  expect(verify?.(context(undefined, 'LEFT'))).toBe(true)
  expect(verify?.(context(undefined, 'RIGHT'))).toBe(false)
  expect(verify?.(context(undefined, 'LEFT', 1))).toBe(false)
  expect(verify?.(context('LEFT', 'LEFT', 1))).toBe(true)
})

test('preferred component keys must remain identical while local IDs follow node paths', () => {
  const definition = {
    id: 'property',
    name: 'Avatar',
    type: 'INSTANCE_SWAP',
    defaultValue: 'old',
    preferredValues: ['external-key']
  }
  const other = { ...definition, defaultValue: 'new', preferredValues: ['external-key'] }
  const ctx = context([definition], [other])
  ctx.aNodePaths = new Map([['old', '0/0']])
  ctx.bNodePaths = new Map([['new', '0/0']])
  const verify = SCENE_VERIFIERS.get('componentPropertyDefinitions')
  expect(verify).toBeDefined()
  expect(verify?.(ctx)).toBe(true)
  other.preferredValues = ['different-key']
  expect(verify?.(ctx)).toBe(false)
  definition.preferredValues = ['old']
  other.preferredValues = ['new']
  expect(verify?.(ctx)).toBe(true)
  ctx.bNodePaths = new Map([['new', '0/1']])
  expect(verify?.(ctx)).toBe(false)
})
