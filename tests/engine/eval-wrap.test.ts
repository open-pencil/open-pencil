import { describe, expect, test } from 'bun:test'

import { wrapEvalCode } from '../../src/automation/eval-wrap'

// Helper: execute the wrapped code and return the result
async function run(code: string): Promise<unknown> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
    ...args: string[]
  ) => (...a: unknown[]) => Promise<unknown>
  const fn = new AsyncFunction(wrapEvalCode(code))
  return fn()
}

describe('wrapEvalCode', () => {
  describe('output (REPL return value)', () => {
    test('bare numeric literal is returned', async () => {
      expect(await run('42')).toBe(42)
    })

    test('bare string literal is returned', async () => {
      expect(await run('"hello"')).toBe('hello')
    })

    test('bare expression with arithmetic is returned', async () => {
      expect(await run('1 + 2')).toBe(3)
    })

    test('multi-line code: last expression is returned', async () => {
      expect(await run('const x = 10\nx * 2')).toBe(20)
    })

    test('code already starting with return is unchanged', async () => {
      expect(await run('return 99')).toBe(99)
    })

    test('variable declaration alone wraps in IIFE (returns undefined)', async () => {
      expect(await run('const x = 5')).toBeUndefined()
    })

    test('trailing semicolon is treated as statement', async () => {
      // ends with ; → full IIFE → undefined
      expect(await run('42;')).toBeUndefined()
    })

    test('trailing closing brace is treated as statement', async () => {
      expect(await run('function f() {}\nf()')).toBe(undefined)
    })

    test('await expression in last line is returned', async () => {
      expect(await run('await Promise.resolve(7)')).toBe(7)
    })

    test('object expression is returned', async () => {
      expect(await run('({ a: 1 })')).toEqual({ a: 1 })
    })

    test('array expression is returned', async () => {
      expect(await run('[1, 2, 3]')).toEqual([1, 2, 3])
    })
  })

  describe('wrapping shape', () => {
    test('bare expression wraps with return (expr)', () => {
      expect(wrapEvalCode('42')).toBe('return (42)')
    })

    test('multi-line: body lines kept, last promoted', () => {
      const result = wrapEvalCode('const x = 1\nx + 1')
      expect(result).toBe('const x = 1\nreturn (x + 1)')
    })

    test('return prefix: code is unchanged', () => {
      const code = 'return figma.currentPage.name'
      expect(wrapEvalCode(code)).toBe(code)
    })

    test('const declaration: wraps in IIFE', () => {
      const result = wrapEvalCode('const x = 1')
      expect(result).toContain('async ()')
    })

    test('if statement: wraps in IIFE', () => {
      const result = wrapEvalCode('if (true) { }')
      expect(result).toContain('async ()')
    })

    test('leading/trailing whitespace is trimmed', () => {
      expect(wrapEvalCode('  42  ')).toBe('return (42)')
    })
  })
})
