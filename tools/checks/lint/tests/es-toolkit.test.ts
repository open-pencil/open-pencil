import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'prefer-es-toolkit'
const rules = { [`open-pencil/${rule}`]: 'error' }

describe('prefer-es-toolkit', () => {
  test.each([
    '[...new Set(items.map((item) => item.id))]',
    '[...new Set([...items, 4])]',
    'Array.from(new Set(text.split(",")))',
    'items.filter(Boolean)'
  ])('rejects %s', async (source) => {
    expect(
      ruleDiagnostics(
        await lint(`declare const items: number[]; declare const text: string; ${source}`, rules),
        rule
      )
    ).toHaveLength(1)
  })

  test.each([
    // Without types an identifier may hold any iterable, such as a string or a Map's keys.
    '[...new Set(items)]',
    '[...new Set(text)]',
    'Array.from(new Set(items), (item) => item * 2)',
    '[...new Set(items.map((item) => item)), 4]',
    'items.filter((item) => item > 0)',
    // An iterator's filter is not an array's, and compact takes arrays only.
    'declare const map: Map<string, number>; map.values().filter(Boolean)',
    // Playwright serializes evaluate callbacks into the page, where imports do not exist.
    'declare const page: { evaluate(fn: () => unknown): unknown }; page.evaluate(() => items.filter(Boolean))',
    'declare const page: { $$eval(selector: string, fn: () => unknown): unknown }; page.$$eval("p", () => [...new Set(items.map((item) => item))])',
    'const Boolean = (value: number) => value > 1; items.filter(Boolean)',
    'class Set<T> { constructor(_values: T[]) {} }; [...(new Set(items.map((item) => item)) as unknown as number[])]'
  ])('accepts %s', async (source) => {
    expect(
      ruleDiagnostics(
        await lint(`declare const items: number[]; declare const text: string; ${source}`, rules),
        rule
      )
    ).toHaveLength(0)
  })
})
