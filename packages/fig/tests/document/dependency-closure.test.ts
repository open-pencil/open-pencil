import { expect, test } from 'bun:test'

import { collectSceneDependencies } from '#fig/document/dependency-closure'
import { createSourceIndex } from '#fig/instance-overrides/source-index'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange, Paint } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

test('retains external preferred choices separately from required component dependencies', () => {
  const changes = [
    { guid: guid(1), type: 'CANVAS' },
    {
      guid: guid(2),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '!' },
      componentPropDefs: [
        {
          id: guid(90),
          type: 'INSTANCE_SWAP',
          initialValue: { guidValue: guid(3) },
          preferredValues: { instanceSwapValues: [{ key: 'external' }, { key: 'local' }] }
        }
      ]
    },
    { guid: guid(3), type: 'SYMBOL', key: 'local', parentIndex: { guid: guid(4), position: '!' } },
    { guid: guid(4), type: 'CANVAS', internalOnly: true }
  ] as NodeChange[]
  const result = collectSceneDependencies(changes, undefined, createSourceIndex(changes))
  expect(result.contentIds.has('1:3')).toBe(true)
  expect([...result.externalPreferredKeys]).toEqual(['external'])
  expect(result.missingIds.size).toBe(0)
})

test('includes component ownership without pulling in unrelated internal definitions', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'CANVAS',
      internalOnly: true,
      parentIndex: { guid: guid(1), position: '"' }
    },
    { guid: guid(4), type: 'FRAME', parentIndex: { guid: guid(3), position: '!' } },
    { guid: guid(5), type: 'SYMBOL', parentIndex: { guid: guid(4), position: '!' } },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(4), position: '"' },
      symbolData: { symbolID: guid(99) }
    },
    {
      guid: guid(7),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: '!' },
      symbolData: { symbolID: guid(5) }
    }
  ]
  const result = collectSceneDependencies(changes, undefined, createSourceIndex(changes))
  expect([...result.contentIds].sort()).toEqual(['1:2', '1:5', '1:7'])
  expect(result.ancestorIds.has('1:4')).toBe(true)
  expect(result.missingIds.size).toBe(0)
  expect(result.contentIds.has('1:6')).toBe(false)
  const assembled = materializeDocument(changes)
  const componentId = assembled.sources.get('1:5')
  if (!componentId) throw new Error('Missing required component')
  expect(assembled.graph.getNode(componentId)?.parentId).toBe(assembled.sources.get('1:4'))
  expect(assembled.sources.has('1:6')).toBe(false)
  const closureChanges = [
    ...changes,
    {
      guid: guid(8),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: '"' },
      symbolData: { symbolID: guid(99) }
    }
  ] as NodeChange[]
  const reached = collectSceneDependencies(
    closureChanges,
    undefined,
    createSourceIndex(closureChanges)
  )
  expect([...reached.missingComponentIds]).toEqual(['1:99'])
  expect(reached.missingIds.size).toBe(0)
})

// Switching an instance's variant needs the rest of its set, but not the layers beside the set
// on its page. A set on Figma's internal canvas is a library copy kept for the variants the file
// uses, so its other variants stay out.
test('includes the other variants of a used variant’s set, not the set’s page or library copies', () => {
  const variantProperty = [{ id: guid(90), type: 'VARIANT', name: 'State' }]
  const under = (parent: number, position: string) => ({ guid: guid(parent), position })
  const changes = [
    { guid: guid(1), type: 'CANVAS' },
    { guid: guid(2), type: 'CANVAS' },
    {
      guid: guid(3),
      type: 'FRAME',
      parentIndex: under(2, '!'),
      componentPropDefs: variantProperty
    },
    { guid: guid(4), type: 'SYMBOL', parentIndex: under(3, '!') },
    { guid: guid(5), type: 'SYMBOL', parentIndex: under(3, '"') },
    { guid: guid(6), type: 'FRAME', parentIndex: under(2, '"') },
    { guid: guid(7), type: 'CANVAS', internalOnly: true },
    {
      guid: guid(8),
      type: 'FRAME',
      parentIndex: under(7, '!'),
      componentPropDefs: variantProperty
    },
    { guid: guid(9), type: 'SYMBOL', parentIndex: under(8, '!') },
    { guid: guid(10), type: 'SYMBOL', parentIndex: under(8, '"') },
    {
      guid: guid(11),
      type: 'INSTANCE',
      parentIndex: under(1, '!'),
      symbolData: { symbolID: guid(4) }
    },
    {
      guid: guid(12),
      type: 'INSTANCE',
      parentIndex: under(1, '"'),
      symbolData: { symbolID: guid(9) }
    }
  ] as NodeChange[]
  const result = collectSceneDependencies(changes, new Set(['1:1']), createSourceIndex(changes))
  expect(result.contentIds.has('1:4')).toBe(true)
  expect(result.contentIds.has('1:5')).toBe(true)
  expect(result.contentIds.has('1:6')).toBe(false)
  expect(result.contentIds.has('1:9')).toBe(true)
  expect(result.contentIds.has('1:10')).toBe(false)
})

// The reader takes a record typed as a set for one, as a frame with a variant property is.
test('includes the other variants of a set its record types as one', () => {
  const under = (parent: number, position: string) => ({ guid: guid(parent), position })
  const changes = [
    { guid: guid(1), type: 'CANVAS' },
    { guid: guid(2), type: 'CANVAS' },
    { guid: guid(3), type: 'COMPONENT_SET', parentIndex: under(2, '!') },
    { guid: guid(4), type: 'SYMBOL', parentIndex: under(3, '!') },
    { guid: guid(5), type: 'SYMBOL', parentIndex: under(3, '"') },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: under(1, '!'),
      symbolData: { symbolID: guid(4) }
    }
  ] as NodeChange[]
  const result = collectSceneDependencies(changes, new Set(['1:1']), createSourceIndex(changes))
  expect(result.contentIds.has('1:5')).toBe(true)
})

test('reads a root record with what it needs, and none of its siblings', () => {
  const changes = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'CANVAS',
      internalOnly: true,
      parentIndex: { guid: guid(1), position: '"' }
    },
    {
      guid: guid(4),
      type: 'FRAME',
      componentPropDefs: [{ id: guid(90), type: 'VARIANT', name: 'State' }],
      parentIndex: { guid: guid(3), position: '!' }
    },
    { guid: guid(5), type: 'SYMBOL', parentIndex: { guid: guid(4), position: '!' } },
    { guid: guid(6), type: 'SYMBOL', parentIndex: { guid: guid(4), position: '"' } },
    { guid: guid(7), type: 'SYMBOL', parentIndex: { guid: guid(3), position: '"' } },
    {
      guid: guid(8),
      type: 'INSTANCE',
      parentIndex: { guid: guid(6), position: '!' },
      symbolData: { symbolID: guid(7) }
    }
  ] as NodeChange[]
  const index = createSourceIndex(changes)
  const result = collectSceneDependencies(changes, new Set(), index, undefined, ['1:6'])
  expect([...result.contentIds].toSorted()).toEqual(['1:6', '1:7', '1:8'])
  expect(result.ancestorIds.has('1:4')).toBe(true)
  expect(result.contentIds.has('1:5')).toBe(false)
})

function patternPaint(source: number): Paint {
  return { type: 'PATTERN', opacity: 1, visible: true, sourceNodeId: guid(source) }
}

function patternDocument(target: Partial<NodeChange>): NodeChange[] {
  return [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'CANVAS',
      internalOnly: true,
      parentIndex: { guid: guid(1), position: '"' }
    },
    { guid: guid(4), type: 'FRAME', parentIndex: { guid: guid(3), position: '!' } },
    { guid: guid(5), type: 'SYMBOL', parentIndex: { guid: guid(4), position: '!' } },
    { guid: guid(6), type: 'VECTOR', parentIndex: { guid: guid(5), position: '!' } },
    { guid: guid(7), type: 'FRAME', parentIndex: { guid: guid(3), position: '"' } },
    {
      guid: guid(8),
      type: 'ROUNDED_RECTANGLE',
      parentIndex: { guid: guid(2), position: '!' },
      ...target
    }
  ] as NodeChange[]
}

test('reaches the layer a pattern paint tiles, wherever it is kept', () => {
  for (const target of [
    { fillPaints: [patternPaint(5)] },
    { strokePaints: [patternPaint(5)] },
    {
      type: 'VECTOR',
      vectorData: { styleOverrideTable: [{ styleID: 1, fillPaints: [patternPaint(5)] }] }
    },
    {
      type: 'TEXT',
      textData: {
        characters: 'ab',
        characterStyleIDs: [0, 1],
        styleOverrideTable: [{ styleID: 1, fillPaints: [patternPaint(5)] }]
      }
    }
  ] as Partial<NodeChange>[]) {
    const changes = patternDocument(target)
    const result = collectSceneDependencies(changes, undefined, createSourceIndex(changes))
    expect([...result.contentIds].sort()).toEqual(['1:2', '1:5', '1:6', '1:8'])
    expect(result.ancestorIds.has('1:4')).toBe(true)
    expect(result.missingIds.size).toBe(0)
  }
  const assembled = materializeDocument(patternDocument({ fillPaints: [patternPaint(5)] }))
  const sourceId = assembled.sources.get('1:5')
  if (!sourceId) {
    throw new Error('Missing pattern source')
  }
  expect(assembled.graph.getNode(sourceId)?.childIds).toHaveLength(1)
  expect(assembled.sources.has('1:7')).toBe(false)
})

test('reaches a pattern source an instance override paints with', () => {
  const changes = patternDocument({
    type: 'INSTANCE',
    symbolData: {
      symbolID: guid(7),
      symbolOverrides: [{ guidPath: { guids: [guid(9)] }, fillPaints: [patternPaint(5)] }]
    }
  } as Partial<NodeChange>)
  const result = collectSceneDependencies(changes, undefined, createSourceIndex(changes))
  expect(result.contentIds.has('1:5')).toBe(true)
})

test('leaves a pattern source the archive lacks out of the missing records', () => {
  const changes = patternDocument({ fillPaints: [patternPaint(99)] })
  const result = collectSceneDependencies(changes, undefined, createSourceIndex(changes))
  expect(result.missingIds.size).toBe(0)
  expect(result.contentIds.has('1:99')).toBe(false)
})
