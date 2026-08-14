import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { canvas, doc, node } from './helpers'

describe('fig-import: variable asset refs', () => {
  test('imports node-scoped modes and native paint aliases', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      {
        ...node('VARIABLE_SET', 20, 1),
        name: 'Theme',
        variableSetModes: [
          { id: { sessionID: 10, localID: 1 }, name: 'Light' },
          { id: { sessionID: 10, localID: 2 }, name: 'Dark' }
        ]
      } as NodeChange,
      {
        ...node('VARIABLE', 21, 1),
        name: 'Background',
        variableSetID: { guid: { sessionID: 1, localID: 20 } },
        variableResolvedType: 'COLOR',
        variableDataValues: {
          entries: [
            {
              modeID: { sessionID: 10, localID: 1 },
              variableData: {
                dataType: 'COLOR',
                resolvedDataType: 'COLOR',
                value: { colorValue: { r: 1, g: 1, b: 1, a: 1 } }
              }
            },
            {
              modeID: { sessionID: 10, localID: 2 },
              variableData: {
                dataType: 'COLOR',
                resolvedDataType: 'COLOR',
                value: { colorValue: { r: 0, g: 0, b: 0, a: 1 } }
              }
            }
          ]
        }
      } as NodeChange,
      node('FRAME', 30, 1, {
        name: 'Dark scope',
        variableModeBySetMap: {
          entries: [
            {
              variableSetID: { guid: { sessionID: 1, localID: 20 } },
              variableModeID: { sessionID: 10, localID: 2 }
            }
          ]
        },
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 1, g: 1, b: 1, a: 1 },
            colorVar: {
              value: { alias: { guid: { sessionID: 1, localID: 21 } } },
              dataType: 'ALIAS',
              resolvedDataType: 'COLOR'
            }
          }
        ] as NodeChange['fillPaints']
      })
    ])

    const frame = expectDefined(
      [...graph.getAllNodes()].find((candidate) => candidate.name === 'Dark scope'),
      'dark scope'
    )
    expect(frame.variableModes).toEqual({ '1:20': '10:2' })
    expect(frame.boundVariables['fills/0/color']).toBe('1:21')
    expect(graph.resolveColorVariableForNode(frame.id, '1:21')).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 1
    })
  })

  test('imports native scalar variable bindings', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      {
        ...node('VARIABLE_SET', 20, 1),
        variableSetModes: [{ id: { sessionID: 10, localID: 1 }, name: 'Default' }]
      } as NodeChange,
      {
        ...node('VARIABLE', 21, 1),
        variableSetID: { guid: { sessionID: 1, localID: 20 } },
        variableResolvedType: 'FLOAT',
        variableDataValues: {
          entries: [
            {
              modeID: { sessionID: 10, localID: 1 },
              variableData: {
                dataType: 'FLOAT',
                resolvedDataType: 'FLOAT',
                value: { floatValue: 50 }
              }
            }
          ]
        }
      } as NodeChange,
      node('FRAME', 30, 1, {
        opacity: 0.2,
        variableConsumptionMap: {
          entries: [
            {
              variableField: 'OPACITY',
              variableData: {
                dataType: 'ALIAS',
                resolvedDataType: 'FLOAT',
                value: { alias: { guid: { sessionID: 1, localID: 21 } } }
              }
            },
            {
              variableField: 'WIDTH',
              variableData: {
                dataType: 'ALIAS',
                resolvedDataType: 'FLOAT',
                value: { alias: { guid: { sessionID: 1, localID: 21 } } }
              }
            }
          ]
        }
      })
    ])

    const frame = expectDefined(
      [...graph.getAllNodes()].find((candidate) => candidate.name === 'FRAME_30'),
      'bound frame'
    )
    expect(frame.opacity).toBe(0.5)
    expect(frame.width).toBe(50)
    expect(frame.boundVariables.opacity).toBe('1:21')
    expect(frame.boundVariables.width).toBe('1:21')
    expect(graph.resolveNumberVariableForNode(frame.id, '1:21')).toBe(50)
  })

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
