import { expect, test } from 'bun:test'

import { resolveDocumentBindingReferences } from '#fig/document/binding-references'
import { nodeChangeToProps } from '@open-pencil/fig/node-change'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 1, localID })

test('normalizes versioned scalar, paint and mode references without mutating source records', () => {
  const changes = [
    { guid: guid(1), type: 'VARIABLE', key: 'number', version: 'v1' },
    { guid: guid(2), type: 'VARIABLE', key: 'color', version: 'v1' },
    { guid: guid(3), type: 'VARIABLE_SET', key: 'set', version: 'v1' },
    {
      guid: guid(4),
      type: 'RECTANGLE',
      variableConsumptionMap: {
        entries: [
          {
            variableField: 'WIDTH',
            variableData: { value: { alias: { assetRef: { key: 'number', version: 'v1' } } } }
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
          { variableSetID: { assetRef: { key: 'set', version: 'v1' } }, variableModeID: guid(10) }
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
})
