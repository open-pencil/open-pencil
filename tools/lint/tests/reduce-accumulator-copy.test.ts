import { afterEach, describe, expect, test } from 'bun:test'

import { cleanupLintFixtures, lint, ruleDiagnostics } from '#lint/support/lint-test.ts'

const rule = 'no-reduce-accumulator-copy'
const rules = { [`open-pencil/${rule}`]: 'error' }

afterEach(cleanupLintFixtures)

describe('no-reduce-accumulator-copy', () => {
  test.each([
    'items.reduce((acc, item) => acc.concat([item]), [])',
    'items.reduce((acc, item) => { const next = acc.slice(); next.push(item); return next }, [])',
    'items.reduce((acc, item) => Object.assign({}, acc, { [item.id]: item }), {})',
    'items.reduce((acc, item) => Array.from(acc), [])'
  ])('rejects copying a growing accumulator: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    'items.reduce((acc, item) => { acc.push(item); return acc }, [])',
    'items.reduce((acc, item) => Object.assign(acc, { [item.id]: item }), {})',
    'items.reduce((acc, item) => item.slice(), [])',
    'items.reduce(namedReducer, [])'
  ])('accepts owned mutation and unrelated copies: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
