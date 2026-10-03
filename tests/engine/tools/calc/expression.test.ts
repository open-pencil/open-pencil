import { describe, expect, test } from 'bun:test'

import {
  CALC_FUNCTIONS,
  CalcSyntaxError,
  evaluateExpression
} from '@open-pencil/core/tools/calc/expression'

describe('calc expression evaluator', () => {
  test.each([
    ['844 - 56 - 96 - 82', 610],
    ['1440 * 8 / 12', 960],
    ['(952 - 16) / 2', 468],
    ['  8   *   4  ', 32],
    ['2 + 2 * 2', 6],
    ['(2 + 2) * 2', 8],
    ['7 / 2', 3.5],
    ['10 % 3', 1],
    ['-10 % 3', -1],
    ['1e3', 1000],
    ['1E3 + 1', 1001],
    ['.5 + 1', 1.5],
    ['1.', 1],
    ['2.5e-2', 0.025]
  ])('evaluates %s', (expression, expected) => {
    expect(evaluateExpression(expression)).toBe(expected)
  })

  test.each([
    ['-5', -5],
    ['+5', 5],
    ['3 - -2', 5],
    ['3 * -2', -6],
    ['-(2 + 3)', -5]
  ])('applies the sign in %s', (expression, expected) => {
    expect(evaluateExpression(expression)).toBe(expected)
  })

  describe('exponentiation', () => {
    test('is right-associative', () => {
      expect(evaluateExpression('2 ** 3 ** 2')).toBe(512)
    })

    // jsep binds a leading sign tighter than `**`, so `-2 ** 2` is `(-2) ** 2`.
    // Pinned because Python and ordinary notation instead read it as `-(2 ** 2)`.
    test('applies a leading sign before the exponent', () => {
      expect(evaluateExpression('-2 ** 2')).toBe(4)
      expect(evaluateExpression('(-2) ** 2')).toBe(4)
      expect(evaluateExpression('-(2 ** 2)')).toBe(-4)
    })

    test('binds tighter than multiplication and accepts a signed exponent', () => {
      expect(evaluateExpression('3 * 2 ** 3')).toBe(24)
      expect(evaluateExpression('2 ** -2')).toBe(0.25)
    })
  })

  describe('functions', () => {
    test.each([
      ['floor(390 * 0.6)', 234],
      ['ceil(1.2)', 2],
      ['round(2.5)', 3],
      ['round(-2.5)', -2],
      ['abs(-4)', 4],
      ['sqrt(16)', 4],
      ['pow(2, 10)', 1024],
      ['min(3, 1, 2)', 1],
      ['max(3, 1, 2)', 3],
      ['min(3)', 3],
      ['max(1 + 1, 3 - 2)', 2],
      ['floor(min(4.7, 9))', 4]
    ])('evaluates %s', (expression, expected) => {
      expect(evaluateExpression(expression)).toBe(expected)
    })

    test('rejects a wrong argument count', () => {
      expect(() => evaluateExpression('round(2.345, 2)')).toThrow(/takes 1 argument, received 2/)
      expect(() => evaluateExpression('pow(2)')).toThrow(/takes 2 arguments, received 1/)
    })

    test.each(['min', 'max'])('folds a long %s argument list without spreading it', (name) => {
      // Spreading overflows the call stack on V8 at roughly 125k arguments.
      const args = Array.from({ length: 200_000 }, (_, index) => index)
      expect(evaluateExpression(`${name}(${args.join(',')})`)).toBe(name === 'min' ? 0 : 199_999)
    })

    test('names the supported functions when one is unknown', () => {
      expect(() => evaluateExpression('sin(0)')).toThrow(/Unknown function 'sin'/)
      for (const name of CALC_FUNCTIONS) {
        expect(() => evaluateExpression('sin(0)')).toThrow(new RegExp(`\\b${name}\\b`))
      }
    })
  })

  describe('results outside the real numbers', () => {
    test.each([
      ['1 / 0', Number.POSITIVE_INFINITY],
      ['-1 / 0', Number.NEGATIVE_INFINITY]
    ])('returns %s as a non-finite number for the caller to report', (expression, expected) => {
      expect(evaluateExpression(expression)).toBe(expected)
    })

    test.each(['0 / 0', 'sqrt(-1)', '0 % 0'])('returns NaN for %s', (expression) => {
      expect(evaluateExpression(expression)).toBeNaN()
    })
  })

  describe('input the evaluator refuses', () => {
    test.each([
      ['', 'Expression is empty'],
      ['   ', 'Expression is empty'],
      ['1 +', 'Expected expression after +'],
      ['(1 + 2', 'Unclosed ('],
      ['1 + 2)', 'Unexpected ")"'],
      ['pow(2, 10', 'Expected )'],
      ['5!', 'missing unaryOp argument'],
      ['1_000 + 1', 'Variable names cannot start with a number'],
      ['0x10', 'Variable names cannot start with a number'],
      ['{"a": 1}', 'Unexpected "{"']
    ])("reports the parser's own message for %s", (expression, message) => {
      expect(() => evaluateExpression(expression)).toThrow(CalcSyntaxError)
      expect(() => evaluateExpression(expression)).toThrow(message)
    })

    test.each([
      ['1 2', 'more than one expression'],
      ['1 ; 2', 'more than one expression'],
      ['3 and 4', 'more than one expression'],
      ['floor 1', 'more than one expression'],
      ['x + 1', 'a name'],
      ['PI', 'a name'],
      ['12 + $', 'a name'],
      ['a.b', 'property access'],
      ['[1,2][0]', 'property access'],
      ['1 ? 2 : 3', 'a conditional']
    ])('names the construct it refuses in %s', (expression, description) => {
      expect(() => evaluateExpression(expression)).toThrow(CalcSyntaxError)
      expect(() => evaluateExpression(expression)).toThrow(description)
    })

    test.each([
      ['2 < 3', "Unsupported operator '<'"],
      ['1 == 1', "Unsupported operator '=='"],
      ['1 || 2', "Unsupported operator '||'"],
      ['3 & 4', "Unsupported operator '&'"]
    ])('refuses the non-arithmetic operator in %s', (expression, message) => {
      expect(() => evaluateExpression(expression)).toThrow(message)
    })

    test.each([
      ['"a" + "b"', 'is not a number'],
      ['true', "'true' is not a number"],
      ['null', "'null' is not a number"]
    ])('refuses the non-numeric literal in %s', (expression, message) => {
      expect(() => evaluateExpression(expression)).toThrow(message)
    })

    test.each([
      ['random()', "Unknown function 'random'"],
      ['if(1, 2, 3)', "Unknown function 'if'"],
      ['sin(0)', "Unknown function 'sin'"]
    ])('refuses the undocumented function in %s', (expression, message) => {
      expect(() => evaluateExpression(expression)).toThrow(message)
    })

    test('keeps the character position the parser reports', () => {
      expect(() => evaluateExpression('(1 + 2')).toThrow('character 6')
    })

    test.each([
      'constructor(1)',
      'toString(1)',
      'valueOf(1)',
      'hasOwnProperty(1)',
      '__defineGetter__(1)'
    ])('refuses %s, an inherited name rather than a function', (expression) => {
      expect(() => evaluateExpression(expression)).toThrow(CalcSyntaxError)
      expect(() => evaluateExpression(expression)).toThrow('Unknown function')
    })
  })

  test.each([
    'constructor',
    'globalThis',
    'this',
    'process',
    'Math',
    'Math.random()',
    'Function("return 1")()',
    '__proto__',
    'constructor.constructor("return 1")()'
  ])('evaluates %s without reaching a host object', (expression) => {
    expect(() => evaluateExpression(expression)).toThrow(CalcSyntaxError)
  })
})
