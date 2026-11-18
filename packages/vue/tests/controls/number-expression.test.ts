import { describe, expect, test } from 'bun:test'

import {
  clampNumberValue,
  evaluateNumberExpression,
  normalizeNumberValue,
  stepNumberValue
} from '#vue/controls/number-expression'

function value(expression: string, current = 20, max = Infinity): number {
  const result = evaluateNumberExpression(expression, { current, max })
  if (!result.ok) throw new Error(`Expected expression to succeed: ${result.error}`)
  return result.value
}

describe('evaluateNumberExpression', () => {
  test('evaluates absolute numbers and arithmetic with precedence', () => {
    expect(value('42')).toBe(42)
    expect(value('12.5')).toBe(12.5)
    expect(value('12*8+4')).toBe(100)
    expect(value('(12 + 8) * 4')).toBe(80)
    expect(value('1e3 / 4')).toBe(250)
  })

  test('supports unary operators inside absolute expressions', () => {
    expect(value('(-4)')).toBe(-4)
    expect(value('2 * -(3 + 1)')).toBe(-8)
  })

  test('evaluates leading operators relative to the current value', () => {
    expect(value('+10')).toBe(30)
    expect(value('-4')).toBe(16)
    expect(value('*2')).toBe(40)
    expect(value('/4')).toBe(5)
  })

  test('evaluates percentages against a finite maximum', () => {
    const result = evaluateNumberExpression('50%', { current: 20, max: 240 })
    expect(result).toEqual({ ok: true, value: 120, kind: 'percent' })
    expect(value('(25 + 25)%', 20, 80)).toBe(40)
  })

  test('rejects percentages without a finite maximum', () => {
    expect(evaluateNumberExpression('50%', { current: 20 })).toEqual({
      ok: false,
      error: 'percent-requires-finite-max'
    })
  })

  test('rejects relative expressions for mixed values', () => {
    expect(evaluateNumberExpression('+10', { current: 0, mixed: true })).toEqual({
      ok: false,
      error: 'relative-requires-value'
    })
    expect(evaluateNumberExpression('42', { current: 0, mixed: true })).toEqual({
      ok: true,
      value: 42,
      kind: 'absolute'
    })
  })

  test('rejects empty, malformed, and non-finite expressions', () => {
    expect(evaluateNumberExpression(' ', { current: 20 })).toEqual({
      ok: false,
      error: 'empty'
    })
    expect(evaluateNumberExpression('12 +', { current: 20 })).toEqual({
      ok: false,
      error: 'syntax'
    })
    expect(evaluateNumberExpression('1 / 0', { current: 20 })).toEqual({
      ok: false,
      error: 'non-finite'
    })
  })

  test('rejects identifiers, calls, members, assignments, and arrays', () => {
    for (const expression of [
      'sqrt(9)',
      'constructor',
      'Object.assign(1)',
      '__proto__.polluted',
      'x = 2',
      '[1, 2]',
      '1; 2',
      '2 ** 4'
    ]) {
      expect(evaluateNumberExpression(expression, { current: 20 })).toEqual({
        ok: false,
        error: 'syntax'
      })
    }
  })
})

describe('number value helpers', () => {
  test('clamps values to finite or one-sided ranges', () => {
    expect(clampNumberValue(12, 0, 10)).toBe(10)
    expect(clampNumberValue(-2, 0)).toBe(0)
    expect(clampNumberValue(4, -Infinity, 10)).toBe(4)
  })

  test('normalizes floating-point noise', () => {
    expect(normalizeNumberValue(0.1 + 0.2)).toBe(0.3)
  })

  test('steps with keyboard modifiers and clamps', () => {
    expect(stepNumberValue(10, 1, 2)).toBe(12)
    expect(stepNumberValue(10, -1, 2, { shiftKey: true })).toBe(-10)
    expect(stepNumberValue(10, 1, 2, { altKey: true })).toBe(10.2)
    expect(stepNumberValue(10, 1, 2, { shiftKey: true, altKey: true })).toBe(12)
    expect(stepNumberValue(9, 1, 2, {}, 0, 10)).toBe(10)
  })
})
