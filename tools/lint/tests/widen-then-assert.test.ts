import { afterEach, describe, expect, test } from 'bun:test'

import { cleanupLintFixtures, lint, ruleDiagnostics } from '#lint/support/lint-test.ts'

const rule = 'no-widen-then-assert'
const rules = { [`open-pencil/${rule}`]: 'error' }

afterEach(cleanupLintFixtures)

describe('no-widen-then-assert', () => {
  test.each([
    'const source: User = loadUser(); const widened: unknown = source; const result = widened as User',
    'const source = { id: "1" }; const widened = source as object; const result = widened as { id: string }',
    'const source = { id: "1" }; const widened: Record<string, unknown> = source; const result = widened as Record<string, string>'
  ])('rejects erasing and recreating local type evidence: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    'declare const input: unknown; const result = input as User',
    'const empty: Record<string, unknown> = {}; const result = empty as Record<string, string>',
    'const source: User = loadUser(); const result = source',
    'let widened: unknown = loadUser(); widened = loadOther(); const result = widened as User',
    'function parse(input: unknown) { return input as User }'
  ])('accepts genuine boundaries and flows that retain evidence: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
