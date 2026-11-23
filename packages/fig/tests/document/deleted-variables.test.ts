import { expect, test } from 'bun:test'

import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

const LIGHT = guid(10)
const DARK = guid(11)

function color(localID: number, name: string, set: number, extra: Partial<NodeChange> = {}) {
  return {
    guid: guid(localID),
    type: 'VARIABLE',
    name,
    variableResolvedType: 'COLOR',
    variableSetID: { guid: guid(set) },
    variableDataValues: {
      entries: [
        {
          modeID: LIGHT,
          variableData: { dataType: 'COLOR', value: { colorValue: { r: 1, g: 0, b: 0, a: 1 } } }
        },
        {
          modeID: DARK,
          variableData: { dataType: 'COLOR', value: { colorValue: { r: 0, g: 0, b: 1, a: 1 } } }
        }
      ]
    },
    ...extra
  } satisfies NodeChange
}

/**
 * Figma keeps a deleted variable in the file, marked `isSoftDeleted`, for the layers still bound
 * to it; deleting a collection marks it and its variables.
 */
function records(): NodeChange[] {
  const modes = [
    { id: LIGHT, name: 'Light' },
    { id: DARK, name: 'Dark' }
  ]
  return [
    { guid: guid(3), type: 'VARIABLE_SET', name: 'Color Scheme', variableSetModes: modes },
    color(4, 'Accent', 3),
    color(5, 'Old accent', 3, { isSoftDeleted: true }),
    {
      guid: guid(6),
      type: 'VARIABLE_SET',
      name: 'Liquid Glass',
      variableSetModes: modes,
      isSoftDeleted: true
    },
    color(7, 'Tint', 6, { isSoftDeleted: true })
  ]
}

test('a deleted variable stays resolvable but leaves its collection’s list', () => {
  const { graph } = materializeDocument(records())
  expect(graph.variableCollections.get('1:3')?.variableIds).toEqual(['1:4'])
  expect(graph.variables.get('1:5')).toMatchObject({ name: 'Old accent', deleted: true })
  expect(graph.resolveColorVariable('1:5')).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  expect(graph.getLiveVariables().map((variable) => variable.name)).toEqual(['Accent'])
})

test('a deleted collection and its variables are kept, out of every list', () => {
  const { graph } = materializeDocument(records())
  expect(graph.variableCollections.get('1:6')).toMatchObject({ deleted: true, variableIds: [] })
  expect(graph.variables.get('1:7')?.deleted).toBe(true)
  expect(graph.getLiveCollections().map((collection) => collection.name)).toEqual(['Color Scheme'])
})

function paintVariable(extra: Partial<NodeChange> = {}): NodeChange {
  // A paint value as Figma writes it; the pinned schema has no PAINT type or paint values.
  const paint = (blendMode: string) => ({
    modeID: LIGHT,
    variableData: {
      dataType: 'PAINT',
      resolvedDataType: 'PAINT',
      value: { paintValue: { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, blendMode } }
    }
  })
  return {
    guid: guid(8),
    type: 'VARIABLE',
    name: 'Fill Variables/Alert/Button BG',
    variableSetID: { guid: guid(3) },
    ...extra,
    ...({
      variableResolvedType: 'PAINT',
      variableDataValues: { entries: [paint('LINEAR_BURN')] }
    } as Partial<NodeChange>)
  }
}

test('a variable of a type OpenPencil does not model refuses the file without a reporter', () => {
  expect(() => materializeDocument([...records(), paintVariable()])).toThrow(
    'Unsupported document resource VARIABLE: unsupported type PAINT'
  )
})

test('a reported variable of an unmodeled type is left out, even with no collection', () => {
  const reported: NodeChange[] = []
  const unsupportedType = (resource: NodeChange) => reported.push(resource)
  const { graph } = materializeDocument(
    [...records(), paintVariable({ isSoftDeleted: true, variableSetID: { guid: guid(99) } })],
    [],
    { onUnsupportedVariableType: unsupportedType }
  )
  expect(graph.variables.has('1:8')).toBe(false)
  expect(reported.map((resource) => resource.name)).toEqual(['Fill Variables/Alert/Button BG'])
  expect(graph.variableCollections.get('1:3')?.variableIds).toEqual(['1:4'])
})
