import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { UNSET_GUID } from '@open-pencil/kiwi/fig/guid'

/** A calendar cell whose day number turned white because the cleared fill style was ignored. */
type Paints = NonNullable<NodeChange['fillPaints']>
const DARK: Paints = [
  { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }
]
const WHITE: Paints = [
  { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }
]
const CLEARED = { guid: { ...UNSET_GUID } }

function calendar(outerOverride?: Record<string, unknown>): NodeChange[] {
  return [
    { guid: guid(1), type: 'SYMBOL', name: 'Calendar Item' },
    {
      guid: guid(2),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      fillPaints: DARK
    },
    { guid: guid(3), type: 'SYMBOL', name: 'Day cell' },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(3), position: '!' },
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(2)] }, fillPaints: WHITE }]
      }
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(3),
        symbolOverrides: outerOverride
          ? [{ guidPath: { guids: [guid(4), guid(2)] }, ...outerOverride }]
          : []
      }
    }
  ] as NodeChange[]
}

const textOf = (changes: NodeChange[]) =>
  interpretInstance(changes, '1:5').children[0].children[0].properties

test('an outer instance that clears the fill style shows the source component fill', () => {
  const text = textOf(calendar({ styleIdForFill: CLEARED, overrideLevel: 1 }))
  expect(text.fillPaints).toEqual(DARK)
  expect(text.styleIdForFill).toBeUndefined()
})

test('without the detach the intermediate component override applies', () => {
  expect(textOf(calendar()).fillPaints).toEqual(WHITE)
})

test('a clearing claim that carries its own paints keeps them', () => {
  const red: Paints = [
    { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
  ]
  expect(textOf(calendar({ styleIdForFill: CLEARED, fillPaints: red })).fillPaints).toEqual(red)
})

test('the source layer keeps its own fill style when the outer instance clears the other one', () => {
  const style = { guid: guid(9) }
  const changes = calendar({ styleIdForFill: CLEARED })
  Object.assign(changes[1], { styleIdForFill: style })
  const text = textOf(changes)
  expect(text.fillPaints).toEqual(DARK)
  expect(text.styleIdForFill).toEqual(style)
})
