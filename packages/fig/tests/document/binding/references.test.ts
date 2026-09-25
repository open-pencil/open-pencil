import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { resolveDocumentBindingReferences } from '#fig/document/binding-references'

import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('shadowed legacy resource references are not treated as required bindings', () => {
  const diagnostics: unknown[] = []
  resolveDocumentBindingReferences(
    [
      {
        guid: guid(1),
        type: 'RECTANGLE',
        variableConsumptionMap: {
          entries: [
            {
              variableField: 'WIDTH',
              variableData: {
                dataType: 'ALIAS',
                value: { alias: { assetRef: { key: 'retired' } } }
              }
            }
          ]
        },
        parameterConsumptionMap: { entries: [{ variableField: 'WIDTH' }] }
      }
    ],
    (diagnostic) => diagnostics.push(diagnostic)
  )
  expect(diagnostics).toEqual([])
})

test('modern explicit clearing removes only the targeted legacy binding', () => {
  const props = nodeChangeToProps(
    {
      type: 'RECTANGLE',
      variableConsumptionMap: {
        entries: [
          { variableField: 'WIDTH', variableData: { value: { alias: { guid: guid(1) } } } },
          { variableField: 'HEIGHT', variableData: { value: { alias: { guid: guid(2) } } } }
        ]
      },
      parameterConsumptionMap: { entries: [{ variableField: 'WIDTH' }] }
    },
    []
  )
  expect(props.boundVariables).toEqual({ height: '1:2' })
})

for (const map of ['variableConsumptionMap', 'parameterConsumptionMap'] as const) {
  for (const expression of [false, true]) {
    test(`${map} ${expression ? 'expression' : 'alias'} normalizes versioned references without mutating source records`, () => {
      const alias = { value: { alias: { assetRef: { key: 'number', version: 'v1' } } } }
      const variableData = expression
        ? {
            dataType: 'EXPRESSION',
            value: {
              expressionValue: {
                expressionFunction: 'MULTIPLY',
                expressionArguments: [{ value: { floatValue: 0.5 } }, alias]
              }
            }
          }
        : alias
      const changes = [
        { guid: guid(1), type: 'VARIABLE', key: 'number', version: 'v1' },
        { guid: guid(2), type: 'VARIABLE', key: 'color', version: 'v1' },
        { guid: guid(3), type: 'VARIABLE_SET', key: 'set', version: 'v1' },
        {
          guid: guid(4),
          type: 'RECTANGLE',
          [map]: {
            entries: [
              {
                variableField: 'WIDTH',
                variableData
              }
            ]
          },
          fillPaints: [
            {
              type: 'SOLID',
              colorVar: { value: { alias: { assetRef: { key: 'color', version: 'v1' } } } }
            }
          ],
          variableModeBySetMap: {
            entries: [
              {
                variableSetID: { assetRef: { key: 'set', version: 'v1' } },
                variableModeID: guid(10)
              }
            ]
          }
        }
      ] as NodeChange[]
      const before = structuredClone(changes)
      const diagnostics: unknown[] = []
      const normalized = resolveDocumentBindingReferences(changes, (d) => diagnostics.push(d))
      const props = nodeChangeToProps(normalized[3], [])
      expect(props.boundVariables).toEqual({ width: '1:1', 'fills/0/color': '1:2' })
      expect(props.variableModes).toEqual({ '1:3': '1:10' })
      expect(diagnostics).toEqual([])
      expect(changes).toEqual(before)
      expect(props.variableBindingScales?.width).toBe(expression ? 0.5 : 1)
    })
  }
}
