import { afterEach, describe, expect, test } from 'bun:test'

import { cleanupLintFixtures, lint, ruleDiagnostics } from '#lint/support/lint-test.ts'

const rule = 'no-known-value-widening'
const rules = { [`open-pencil/${rule}`]: 'error' }

afterEach(cleanupLintFixtures)

describe('no-known-value-widening', () => {
  test.each([
    'const handlers: Record<string, Handler> = { start: startHandler }',
    'const value: unknown = { id: "1" }',
    'function result(): object { return { id: "1" } }'
  ])('identifies discarded local type evidence during audits: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    'const handlers = { start: startHandler } satisfies Record<string, Handler>',
    'declare const input: unknown; const value: unknown = input',
    'const accumulator: Record<string, Handler> = {}'
  ])('accepts preserved inference and genuine boundaries: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
