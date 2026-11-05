import { describe, expect, test } from 'bun:test'

import { wrapEvalCode } from '@open-pencil/core/tools'

type AsyncFn = (...args: unknown[]) => Promise<unknown>
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
  ...args: string[]
) => AsyncFn

async function run(code: string): Promise<unknown> {
  return new AsyncFunction(wrapEvalCode(code))()
}

describe('wrapEvalCode', () => {
  test('bare number is returned', async () => {
    expect(await run('42')).toBe(42)
  })

  test('bare string is returned', async () => {
    expect(await run('"hello"')).toBe('hello')
  })

  test('arithmetic expression is returned', async () => {
    expect(await run('1 + 2')).toBe(3)
  })

  test('multi-line: last expression is returned', async () => {
    expect(await run('const x = 10\nx * 2')).toBe(20)
  })

  test('code starting with return is used verbatim', async () => {
    expect(await run('return 99')).toBe(99)
  })

  test('variable declaration alone returns undefined', async () => {
    expect(await run('const x = 5')).toBeUndefined()
  })

  test('await expression is returned', async () => {
    expect(await run('await Promise.resolve(7)')).toBe(7)
  })

  test('object literal is returned', async () => {
    expect(await run('({ a: 1 })')).toEqual({ a: 1 })
  })

  test('array literal is returned', async () => {
    expect(await run('[1, 2, 3]')).toEqual([1, 2, 3])
  })

  test('function call result is returned', async () => {
    expect(await run('JSON.stringify({ x: 1 })')).toBe('{"x":1}')
  })

  test('expression with trailing semicolon is still returned', async () => {
    expect(await run('42;')).toBe(42)
  })

  test('method chain result is returned', async () => {
    expect(await run('const arr = [3,1,2]\narr.sort()')).toEqual([1, 2, 3])
  })

  test('syntax error falls back to IIFE', () => {
    expect(wrapEvalCode('{')).toContain('async ()')
  })

  test('closing brace wraps in IIFE', () => {
    expect(wrapEvalCode('function f() {}')).toContain('async ()')
  })

  test('if statement wraps in IIFE', () => {
    expect(wrapEvalCode('if (true) { 1 }')).toContain('async ()')
  })

  test('for loop wraps in IIFE', () => {
    expect(wrapEvalCode('for (let i = 0; i < 1; i++) {}')).toContain('async ()')
  })
})
