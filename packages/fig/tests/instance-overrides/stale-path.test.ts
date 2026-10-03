import { expect, test } from 'bun:test'

import { expectPathError } from '#fig-tests/helpers/errors'
import { guid } from '#fig-tests/helpers/guid'
import { interpretInstance } from '#fig/instance-overrides/interpret'
import type { InstancePathDiagnostic } from '#fig/instance-overrides/occurrence/types'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import fixture from './fixtures/stale-chevron-override.json'

test('reports stale property overrides and leaves the actual replacement vector untouched', () => {
  const diagnostics: InstancePathDiagnostic[] = []
  const root = interpretInstance(fixture as NodeChange[], '7:95', {
    onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
  })
  expect(diagnostics).toEqual([
    {
      ownerId: '7:95',
      mainComponentId: '7:94',
      path: [{ sessionID: 7, localID: 93 }],
      reason: 'missing-target'
    }
  ])
  expect(root.children[0].sourceId).toBe('94:5438')
  expect(root.children[0].properties.strokePaints).toBeUndefined()
})

test('diagnostic mode still rejects unresolved structural overrides', () => {
  const changes = structuredClone(fixture) as NodeChange[]
  const owner = changes.find((node) => node.guid?.sessionID === 7 && node.guid.localID === 95)
  if (!owner) throw new Error('Missing fixture owner')
  owner.symbolData = {
    symbolID: { sessionID: 7, localID: 94 },
    symbolOverrides: [
      {
        guidPath: { guids: [{ sessionID: 7, localID: 93 }] },
        overriddenSymbolID: { sessionID: 7, localID: 94 }
      }
    ]
  } as NodeChange['symbolData']
  const diagnostics: InstancePathDiagnostic[] = []
  expectPathError(
    () =>
      interpretInstance(changes, '7:95', {
        onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
      }),
    'missing-target'
  )
  expect(diagnostics).toEqual([])
})

// Actual shadcn records: the old 7:93 path is retained on instance 7:95,
// while component 7:94 contains vector 94:5438. No inferred correspondence.
test('reports the declaring owner and stale path instead of applying it to another vector', () => {
  expect(() => interpretInstance(fixture as NodeChange[], '7:95')).toThrow(
    'Override declared by 7:95, path [7:93]: Expected one instance-path target for 7:93; found 0'
  )
})

// Preline's `_header/navbar` keeps a swap addressing a layer the component no longer has,
// while the replacement it names is still present. Figma opens that file, so a swap whose
// target is gone reports like any other stale record rather than refusing the document.
test('reports a swap whose target layer is gone instead of refusing the file', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL', name: 'navbar' },
    { guid: guid(2), type: 'FRAME', name: 'kept', parentIndex: { guid: guid(1), position: '!' } },
    { guid: guid(3), type: 'SYMBOL', name: 'replacement' },
    {
      guid: guid(4),
      type: 'INSTANCE',
      name: 'navbar instance',
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(99)] }, overriddenSymbolID: guid(3) }]
      }
    }
  ]
  const diagnostics: InstancePathDiagnostic[] = []
  const root = interpretInstance(changes, '1:4', {
    onUnresolvedAssignment: (diagnostic) => diagnostics.push(diagnostic)
  })

  expect(diagnostics).toHaveLength(1)
  expect(diagnostics[0].reason).toBe('missing-target')
  expect(root.children.map((child) => child.properties.name)).toEqual(['kept'])
})

test('an ambiguous swap address is a wrong path, not a stale one', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL', name: 'navbar' },
    {
      guid: guid(2),
      type: 'FRAME',
      name: 'a',
      overrideKey: guid(7),
      parentIndex: { guid: guid(1), position: '!' }
    },
    {
      guid: guid(3),
      type: 'FRAME',
      name: 'b',
      overrideKey: guid(7),
      parentIndex: { guid: guid(1), position: '"' }
    },
    { guid: guid(5), type: 'SYMBOL', name: 'replacement' },
    {
      guid: guid(4),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(7)] }, overriddenSymbolID: guid(5) }]
      }
    }
  ]
  expect(() =>
    interpretInstance(changes, '1:4', { onUnresolvedAssignment: () => undefined })
  ).toThrow('found 2')
})
