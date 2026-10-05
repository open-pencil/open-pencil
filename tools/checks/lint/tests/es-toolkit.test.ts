import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'prefer-es-toolkit'
const rules = { [`open-pencil/${rule}`]: 'error' }

describe('prefer-es-toolkit', () => {
  test.each([
    '[...new Set(items.map((item) => item.id))]',
    '[...new Set([...items, extra])]',
    "Array.from(new Set(text.split(',')))",
    'items.filter(Boolean)'
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    // A variable may hold a string or a Map's keys, which uniq does not take.
    '[...new Set(items)]',
    'Array.from(new Set(items), (item) => item * 2)',
    'items.filter((item) => item > 0)',
    // compact takes arrays, not iterators.
    'map.values().filter(Boolean)',
    // Playwright runs these callbacks in the page, where imports do not exist.
    'page.evaluate(() => items.filter(Boolean))',
    "page.$$eval('p', () => [...new Set(items.map((item) => item.id))])",
    // A local Boolean or Set is not the global one.
    'const Boolean = (value) => value > 1; items.filter(Boolean)',
    'function dedupe(Set) { return [...new Set(items.map((item) => item.id))] }'
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
