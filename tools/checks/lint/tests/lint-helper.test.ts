import { expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-module-mocking'
const rules = { [`open-pencil/${rule}`]: 'error' }

test('rejects parser failures instead of treating them as valid examples', async () => {
  await expect(lint('const = ;', rules)).rejects.toThrow('could not parse')
})

test('rejects invalid rule configuration', async () => {
  await expect(
    lint('export const value = 1', { 'open-pencil/missing-rule': 'error' })
  ).rejects.toThrow()
})

test('isolates concurrent fixtures and retains expected rule errors', async () => {
  const results = await Promise.all([
    lint("import { mock } from 'bun:test'; mock.module('./store')", rules),
    lint('export const value = 1', rules)
  ])
  expect(results.map((result) => ruleDiagnostics(result, rule).length)).toEqual([1, 0])
})
