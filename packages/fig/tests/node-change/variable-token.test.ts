import { describe, expect, test } from 'bun:test'

import { readModeConditions, readVariableToken } from '#fig/node-change/index'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { OPEN_PENCIL_PLUGIN_DATA, OPEN_PENCIL_PLUGIN_ID } from '@open-pencil/scene-graph'

function record(key: string, value: string): NodeChange {
  return { pluginData: [{ pluginID: OPEN_PENCIL_PLUGIN_ID, key, value }] }
}

describe('token plugin data', () => {
  test('a malformed or wrongly shaped entry reads as no token data', () => {
    expect(
      readVariableToken(record(OPEN_PENCIL_PLUGIN_DATA.token.key, '{not json'), { m: 8 })
    ).toEqual({
      unit: undefined,
      expressions: undefined
    })
    expect(
      readVariableToken(record(OPEN_PENCIL_PLUGIN_DATA.token.key, '{"unit":"furlong"}'), { m: 8 })
    ).toEqual({
      unit: undefined,
      expressions: undefined
    })
    expect(
      readModeConditions(record(OPEN_PENCIL_PLUGIN_DATA.modeConditions.key, '{"m":42}'))
    ).toEqual({})
    expect(
      readModeConditions(record(OPEN_PENCIL_PLUGIN_DATA.modeConditions.key, '{"m":"  "}'))
    ).toEqual({})
  })

  test('keep expressions only for modes whose value still matches', () => {
    const nc = record(
      OPEN_PENCIL_PLUGIN_DATA.token.key,
      JSON.stringify({
        unit: 'rem',
        expressions: {
          a: { css: 'clamp(1rem, 4vw, 2rem)', resolved: 16 },
          b: { css: 'clamp(1rem, 4vw, 2rem)', resolved: 16 }
        }
      })
    )
    expect(readVariableToken(nc, { a: 16, b: 20 })).toEqual({
      unit: 'rem',
      expressions: { a: { css: 'clamp(1rem, 4vw, 2rem)', resolved: 16 } }
    })
  })

  test('match a mode value stored at float32 precision', () => {
    const nc = record(
      OPEN_PENCIL_PLUGIN_DATA.token.key,
      JSON.stringify({ expressions: { a: { css: 'calc(100vw / 3)', resolved: 1234.567 } } })
    )
    // What .fig hands back for 1234.567 after storing it as float32.
    expect(readVariableToken(nc, { a: Math.fround(1234.567) }).expressions).toEqual({
      a: { css: 'calc(100vw / 3)', resolved: 1234.567 }
    })
  })
})
