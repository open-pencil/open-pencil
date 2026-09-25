import { expect, test } from 'bun:test'

import { compareSceneOracle, type SceneOracleNode } from '../src/document/scene-oracle'

const node = (path: number[], visible = true): SceneOracleNode => ({
  path,
  visible,
  type: 'RECTANGLE',
  name: 'Node',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  text: null,
  main: null
})

test('separates hidden descendant geometry and detects extra nodes', () => {
  const expected = [node([]), node([0], false), node([0, 0])]
  const actual = structuredClone(expected)
  actual[2].width = 20
  actual.push(node([1]))
  expect(compareSceneOracle(expected, actual).map((d) => d.category)).toEqual([
    'hidden-geometry',
    'structure'
  ])
})

test('normalizes rectangle representation but never hides visibility mismatches', () => {
  const expected = [node([])]
  const actual = [{ ...node([]), type: 'ROUNDED_RECTANGLE' }]
  expect(compareSceneOracle(expected, actual)).toEqual([])
  actual[0].visible = false
  actual[0].width = 11
  expect(compareSceneOracle(expected, actual).map((d) => d.category)).toEqual([
    'semantic',
    'visible-geometry'
  ])
})

test('rejects duplicate addresses', () => {
  expect(() => compareSceneOracle([node([]), node([])], [])).toThrow('Duplicate occurrence path')
})
