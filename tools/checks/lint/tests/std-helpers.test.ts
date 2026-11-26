import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = '@open-pencil/data/no-hand-rolled-std-helpers'
const rules = { [rule]: 'error' }
const path = 'src/app/example.ts'

describe('@open-pencil/data/no-hand-rolled-std-helpers', () => {
  test.each([
    'export const text = (error: unknown) => (error instanceof Error ? error.message : String(error))',
    'export const text = (e: { cause: unknown }) => (e.cause instanceof Error ? e.cause.message : String(e.cause))',
    'export const wrap = (error: unknown) => (error instanceof Error ? error : new Error(String(error)))',
    "export const cancelled = (error: Error) => error.name === 'AbortError'",
    "export const cancelled = (error: Error) => 'AbortError' !== error.name",
    "export const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')",
    "export const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')"
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(1)
  })

  test.each([
    "import { errorMessage } from '@open-pencil/std/errors'\nexport const text = (error: unknown) => errorMessage(error)",
    'export const text = (error: unknown) => (error instanceof Error ? error.message : JSON.stringify(error))',
    'export const text = (a: unknown, b: unknown) => (a instanceof Error ? b : String(a))',
    "export const timedOut = (error: Error) => error.name === 'TimeoutError'",
    "export const glyph = (value: number) => value.toString(16).padStart(8, '0')",
    "export const code = (value: number) => value.toString(16).padStart(2, '0')",
    "export const cell = (value: number) => value.toString(16).padStart(2, ' ')",
    "export const cells = (values: number[]) => values.map((value) => value.toString(16).padStart(2, ' '))",
    "export const channels = (values: number[]) => values.map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))"
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })

  test('leaves tests and the std package alone', async () => {
    const source = "export const cancelled = (error: Error) => error.name === 'AbortError'"
    expect(
      ruleDiagnostics(await lint(source, rules, 'tests/app/example.test.ts'), rule)
    ).toHaveLength(0)
    expect(
      ruleDiagnostics(await lint(source, rules, 'packages/std/src/errors.ts'), rule)
    ).toHaveLength(0)
  })
})
