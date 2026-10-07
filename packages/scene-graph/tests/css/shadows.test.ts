import { describe, expect, test } from 'bun:test'

import type { Color, Effect } from '@open-pencil/scene-graph'
import { parseCSSShadows } from '@open-pencil/scene-graph/css'

const RED: Color = { r: 1, g: 0, b: 0, a: 1 }

function shadow(fields: Partial<Effect>): Effect {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 1 },
    offset: { x: 0, y: 4 },
    radius: 8,
    spread: 0,
    visible: true,
    ...fields
  }
}

describe('parseCSSShadows', () => {
  test.each([
    ['the color last', '0 4px 8px red'],
    ['the color first', 'red 0 4px 8px'],
    ['a color function with spaces', '0 4px 8px rgb(255 0 0)']
  ])('reads a shadow with %s', (_case, value) => {
    expect(parseCSSShadows(value)).toEqual([shadow({ color: RED })])
  })

  test('reads spread, rem lengths, and a translucent color', () => {
    expect(parseCSSShadows('0 0.25rem 8px 2px rgba(0, 0, 0, 0.5)')).toEqual([
      shadow({ spread: 2, color: { r: 0, g: 0, b: 0, a: 0.5 } })
    ])
  })

  test('reads each layer, with inset ones as inner shadows', () => {
    expect(parseCSSShadows('0 4px 8px red, inset 0 1px #000')).toEqual([
      shadow({ color: RED }),
      shadow({ type: 'INNER_SHADOW', offset: { x: 0, y: 1 }, radius: 0 })
    ])
  })

  test('uses black when a layer has no color', () => {
    expect(parseCSSShadows('0 4px 8px')).toEqual([shadow({})])
  })

  test.each(['none', '', '0', 'red', '0 4px 8px transparent', '0 4px 8px red blue'])(
    'reads no shadow from %p',
    (value) => {
      expect(parseCSSShadows(value)).toEqual([])
    }
  )
})
