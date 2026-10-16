import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'

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
