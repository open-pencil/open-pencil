import { describe, expect, test } from 'bun:test'

import { es } from '#emit/index'

describe('es.json', () => {
  test('writes a JSON value as source', () => {
    const value = { color: '#ff3300', count: -2, on: true, none: null, 'a-b': [0.5, { x: 1 }] }

    expect(es.printExpression(es.json(value))).toBe(
      "({\n  color: '#ff3300',\n  count: -2,\n  on: true,\n  none: null,\n  'a-b': [0.5, { x: 1 }]\n})"
    )
  })

  test('writes what JSON cannot hold as null', () => {
    expect(es.printExpression(es.json(Number.POSITIVE_INFINITY))).toBe('null')
    expect(es.printExpression(es.json(() => 1))).toBe('null')
  })
})
