import { expect, test } from 'bun:test'

import { linearVariableExpression } from '#fig/node-change/variable-expression'

import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { VariableDataEntry } from '@open-pencil/kiwi/fig/codec'

const alias: VariableDataEntry = {
  dataType: 'ALIAS',
  value: { alias: { guid: { sessionID: 1, localID: 2 } } }
}
const literal = (floatValue: number): VariableDataEntry => ({
  dataType: 'FLOAT',
  value: { floatValue }
})
const multiply = (...expressionArguments: VariableDataEntry[]): VariableDataEntry => ({
  dataType: 'EXPRESSION',
  value: { expressionValue: { expressionFunction: 'MULTIPLY', expressionArguments } }
})

test('linear products retain their symbolic alias and exact coefficient', () => {
  expect(linearVariableExpression(multiply(literal(2), multiply(alias, literal(0.25))))).toEqual({
    reference: alias.value?.alias,
    multiplier: 0.5
  })
  const props = nodeChangeToProps(
    {
      type: 'FRAME',
      parameterConsumptionMap: {
        entries: [
          {
            variableField: 'OPACITY',
            variableData: multiply(literal(0.5), alias)
          }
        ]
      }
    },
    []
  )
  expect(props.boundVariables).toEqual({ opacity: '1:2' })
  expect(props.variableBindingScales).toEqual({ opacity: 0.005 })
})

test('nonlinear, unsupported, overflowing, and unbounded expressions fail rather than lose bindings', () => {
  expect(() => linearVariableExpression(multiply(alias, alias))).toThrow('one alias')
  expect(() => linearVariableExpression({ dataType: 'EXPRESSION' })).toThrow('Missing')
  expect(() =>
    nodeChangeToProps(
      {
        type: 'FRAME',
        parameterConsumptionMap: {
          entries: [
            {
              variableField: 'WIDTH',
              variableData: multiply(literal(2), literal(3))
            }
          ]
        }
      },
      []
    )
  ).toThrow('one alias')
  expect(() =>
    linearVariableExpression({ value: { expressionValue: { expressionFunction: 'ADD' } } })
  ).toThrow('Unsupported')
  expect(() =>
    linearVariableExpression(multiply(literal(Number.MAX_VALUE), literal(2), alias))
  ).toThrow('non-finite')
  let deep = alias
  for (let index = 0; index < 66; index++) deep = multiply(literal(1), deep)
  expect(() => linearVariableExpression(deep)).toThrow('maximum depth')
})
