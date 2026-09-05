import { expect, test } from 'bun:test'

import { interpretInstance, type InstancePathDiagnostic } from '#fig/instance-overrides/interpret'

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
  expect(() =>
    interpretInstance(changes, '7:95', {
      onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
    })
  ).toThrow('found 0')
  expect(diagnostics).toEqual([])
})

// Actual shadcn records: the old 7:93 path is retained on instance 7:95,
// while component 7:94 contains vector 94:5438. No inferred correspondence.
test('reports the declaring owner and stale path instead of applying it to another vector', () => {
  expect(() => interpretInstance(fixture as NodeChange[], '7:95')).toThrow(
    'Override declared by 7:95, path [7:93]: Expected one instance-path target for 7:93; found 0'
  )
})
