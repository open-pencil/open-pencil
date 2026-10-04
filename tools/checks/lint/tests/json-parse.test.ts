import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-unvalidated-json-parse'
const rules = { [`open-pencil/${rule}`]: 'error' }

describe('no-unvalidated-json-parse', () => {
  test.each([
    'type Foo = { a: number }; JSON.parse(text) as Foo',
    'type Foo = { a: number }; <Foo>JSON.parse(text)',
    'JSON.parse(text) as { a: number }',
    'JSON.parse(text) as unknown as string[]',
    '(JSON.parse(text)) as Record<string, unknown>',
    'globalThis.JSON.parse(text) as string[]',
    "JSON['parse'](text) as string[]",
    'declare const response: Response; (await response.json()) as { a: number }',
    'declare const response: Response; response.json() as Promise<string[]>',
    'declare const file: { json(): Promise<unknown> }; (await file.json()) as string[]'
  ])('rejects %s', async (source) => {
    expect(
      ruleDiagnostics(await lint(`declare const text: string; ${source}`, rules), rule)
    ).toHaveLength(1)
  })

  test.each([
    'JSON.parse(text) as unknown',
    'const value: unknown = JSON.parse(text)',
    'JSON.stringify(text) as string',
    'const JSON = { parse: (value: string) => value }; JSON.parse(text) as string',
    'type Foo = { a: number }; declare const value: unknown; value as Foo',
    'declare const response: Response; (await response.json()) as unknown',
    'declare const response: Response; response.json() as Promise<unknown>',
    'declare const api: { json(key: string): unknown }; api.json(text) as string'
  ])('accepts %s', async (source) => {
    expect(
      ruleDiagnostics(await lint(`declare const text: string; ${source}`, rules), rule)
    ).toHaveLength(0)
  })
})
