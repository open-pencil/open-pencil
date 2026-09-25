import { expect, test } from 'bun:test'

import {
  interpretInstance,
  type InstanceAssignmentDiagnostic
} from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

test('missing assignment targets require explicit partial-evaluation acknowledgement', () => {
  const changes = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      textData: { characters: 'Unchanged' }
    },
    {
      guid: guid(3),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [
          {
            guidPath: { guids: [guid(99)] },
            componentPropAssignments: [{ defID: guid(90), value: { textValue: 'Do not guess' } }]
          }
        ]
      }
    }
  ] as NodeChange[]
  expect(() => interpretInstance(changes, '1:3')).toThrow('found 0')
  const diagnostics: InstanceAssignmentDiagnostic[] = []
  const result = interpretInstance(changes, '1:3', {
    onUnresolvedAssignment: (d) => diagnostics.push(d)
  })
  expect(result.children[0].properties.textData?.characters).toBe('Unchanged')
  expect(diagnostics).toEqual([
    {
      ownerId: '1:3',
      mainComponentId: '1:1',
      reason: 'missing-target',
      path: [guid(99)],
      assignments: [{ defID: guid(90), value: { textValue: 'Do not guess' } }]
    }
  ])
})
