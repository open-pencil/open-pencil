import { expect, test } from 'bun:test'

import {
  interpretInstance,
  type InstanceOccurrence,
  type InstancePathDiagnostic
} from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import fixture from './fixtures/accordion-source-closure.json'

function texts(node: InstanceOccurrence): string[] {
  return [
    ...(node.properties.type === 'TEXT' ? [node.properties.textData?.characters ?? ''] : []),
    ...node.children.flatMap(texts)
  ]
}

test('full Accordion source records preserve independent labels while reporting stale overrides', () => {
  const diagnostics: InstancePathDiagnostic[] = []
  const result = interpretInstance(fixture as NodeChange[], '7:283', {
    onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
  })
  expect(result.children.map((node) => node.mainComponentId)).toEqual(['7:251', '7:156', '7:156'])
  expect(result.children.map((node) => texts(node)[0])).toEqual([
    'Is it accessible?',
    'Is it styled?',
    'Is it animated?'
  ])
  // The first item is swapped to 7:251, which has no 7:95 occurrence; only the two
  // triggers that exist in the result report the stale 7:93 path.
  expect(diagnostics).toHaveLength(2)
  for (const diagnostic of diagnostics) {
    expect(diagnostic).toEqual({
      ownerId: '7:95',
      mainComponentId: '7:94',
      path: [{ sessionID: 7, localID: 93 }],
      reason: 'missing-target'
    })
  }
})
