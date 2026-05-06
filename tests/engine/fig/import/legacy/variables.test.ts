import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { canvas, doc, node } from './helpers'

describe('fig-import: variable asset refs', () => {
  test('resolves color variables and aliases by assetRef', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      {
        ...node('VARIABLE_SET', 20, 1),
        name: 'Tokens',
        key: 'collection-key',
        version: '1:1',
        variableSetModes: [{ id: { sessionID: 10, localID: 1 }, name: 'Default' }]
      } as NodeChange,
      {
        ...node('VARIABLE', 21, 1),
        name: 'Blue',
        key: 'blue-key',
        version: '1:2',
        variableSetID: { assetRef: { key: 'collection-key', version: '1:1' } },
        variableResolvedType: 'COLOR',
        variableDataValues: {
          entries: [
            {
              modeID: { sessionID: 10, localID: 1 },
              variableData: {
                dataType: 'COLOR',
                resolvedDataType: 'COLOR',
                value: { colorValue: { r: 0.14, g: 0.39, b: 0.92, a: 1 } }
              }
            }
          ]
        }
      } as NodeChange,
      {
        ...node('VARIABLE', 22, 1),
        name: 'Primary',
        key: 'primary-key',
        version: '1:3',
        variableSetID: { assetRef: { key: 'collection-key', version: '1:1' } },
        variableResolvedType: 'COLOR',
        variableDataValues: {
          entries: [
            {
              modeID: { sessionID: 10, localID: 1 },
              variableData: {
                dataType: 'ALIAS',
                resolvedDataType: 'COLOR',
                value: { alias: { assetRef: { key: 'blue-key', version: '1:2' } } }
              }
            }
          ]
        }
      } as NodeChange,
      node('TEXT', 30, 1, {
        textData: { characters: 'browse' },
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            colorVar: {
              value: { alias: { assetRef: { key: 'primary-key', version: '1:3' } } },
              dataType: 'ALIAS',
              resolvedDataType: 'COLOR'
            }
          }
        ] as NodeChange['fillPaints']
      })
    ])

    const primary = expectDefined(
      [...graph.variables.values()].find((v) => v.name === 'Primary'),
      'Primary variable'
    )
    const resolved = expectDefined(graph.resolveColorVariable(primary.id), 'resolved Primary color')
    expect(resolved.r).toBeCloseTo(0.14)
    expect(resolved.g).toBeCloseTo(0.39)
    expect(resolved.b).toBeCloseTo(0.92)

    const text = expectDefined(
      [...graph.getAllNodes()].find((n) => n.type === 'TEXT' && n.text === 'browse'),
      'browse text node'
    )
    expect(text.fills[0].color.r).toBeCloseTo(0.14)
    expect(text.fills[0].color.g).toBeCloseTo(0.39)
    expect(text.fills[0].color.b).toBeCloseTo(0.92)
  })
})
