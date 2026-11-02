import { expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '#fig-tests/helpers/fig-fixtures'
import { guid } from '#fig-tests/helpers/guid'
import { materializeDocument } from '#fig/document/materialize'
import { materializeVariableResources } from '#fig/document/variables'

import { parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

function resources(operand: VariableDataEntry): NodeChange[] {
  return [
    { guid: guid(3), type: 'VARIABLE_SET', variableSetModes: [{ id: guid(10), name: 'Default' }] },
    {
      guid: guid(4),
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: guid(3) },
      variableDataValues: {
        entries: [
          {
            modeID: guid(10),
            variableData: {
              dataType: 'EXPRESSION',
              resolvedDataType: 'FLOAT',
              value: {
                expressionValue: {
                  expressionFunction: 'ADDITION',
                  expressionArguments: [operand, { dataType: 'FLOAT', value: { floatValue: 2 } }]
                }
              }
            }
          }
        ]
      }
    }
  ]
}

test('FIG formulas preserve valid operands and report incompatible definitions without coercion', () => {
  const { graph } = materializeDocument(resources({ dataType: 'FLOAT', value: { floatValue: 3 } }))
  expect(graph.resolveVariable('1:4')).toBe(5)
  const operands: VariableDataEntry[] = [
    { dataType: 'BOOLEAN', value: { boolValue: true } },
    { dataType: 'FLOAT', value: { floatValue: Infinity } },
    {
      dataType: 'EXPRESSION',
      resolvedDataType: 'BOOLEAN',
      value: {
        expressionValue: {
          expressionFunction: 'NOT',
          expressionArguments: [{ dataType: 'BOOLEAN', value: { boolValue: false } }]
        }
      }
    }
  ]
  for (const operand of operands) {
    const reported: NodeChange[] = []
    const { graph: invalid } = materializeDocument(resources(operand), [], {
      onUnsupportedResource: (node) => reported.push(node)
    })
    expect(invalid.variables.size).toBe(0)
    expect(reported).toEqual([resources(operand)[1]])
  }
})

function collectionWithModes(modes: NonNullable<NodeChange['variableSetModes']>): NodeChange[] {
  return [{ guid: guid(3), type: 'VARIABLE_SET', variableSetModes: modes }]
}

function listedModes(changes: NodeChange[]) {
  const collection = materializeDocument(changes).graph.variableCollections.get('1:3')
  if (!collection) {
    throw new Error('Missing collection')
  }
  return {
    names: collection.modes.map((mode) => mode.name),
    defaultModeId: collection.defaultModeId
  }
}

test('a collection lists its modes by sort position and defaults to the first listed', () => {
  const listed = listedModes(
    collectionWithModes([
      { id: guid(10), name: 'A', sortPosition: 'b' },
      { id: guid(11), name: 'B', sortPosition: 'a' }
    ])
  )
  expect(listed).toEqual({ names: ['B', 'A'], defaultModeId: '1:11' })
})

test('modes without a sort position follow the positioned ones in saved order', () => {
  const listed = listedModes(
    collectionWithModes([
      { id: guid(10), name: 'A' },
      { id: guid(11), name: 'B', sortPosition: 'b' },
      { id: guid(12), name: 'C', sortPosition: 'a' },
      { id: guid(13), name: 'D' }
    ])
  )
  expect(listed).toEqual({ names: ['C', 'B', 'A', 'D'], defaultModeId: '1:12' })
})

test('modes sharing a sort position keep their saved order', () => {
  const listed = listedModes(
    collectionWithModes([
      { id: guid(10), name: 'A', sortPosition: 'a' },
      { id: guid(11), name: 'B', sortPosition: 'a' }
    ])
  )
  expect(listed).toEqual({ names: ['A', 'B'], defaultModeId: '1:10' })
})

test('a saved collection lists its modes in the order Figma shows them', () => {
  const { nodeChanges } = parseFigBuffer(readFixtureArrayBuffer('gold-preview.fig'))
  const graph = new SceneGraph()
  materializeVariableResources(graph, nodeChanges, () => undefined)
  const tokens = [...graph.variableCollections.values()].find((c) => c.name === 'Tokens')
  expect(tokens?.modes.map((mode) => mode.name)).toEqual([
    'Default',
    'Default (Dark)',
    'Harvest',
    'Harvest (Dark)',
    'Retro',
    'Retro (Dark)'
  ])
})
