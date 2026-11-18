import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

async function count(rule: string, source: string): Promise<number> {
  return ruleDiagnostics(await lint(source, { [rule]: 'error' }), rule).length
}

describe('@open-pencil/types/no-broad-double-cast', () => {
  test.each([
    'export const result = value as unknown as Point',
    'export const result = <unknown>value as Point',
    'export const result = ((value as unknown)) as Point'
  ])('rejects %s', async (source) => {
    expect(await count('@open-pencil/types/no-broad-double-cast', source)).toBe(1)
  })

  test('accepts a single assertion', async () => {
    expect(
      await count('@open-pencil/types/no-broad-double-cast', 'export const result = value as Point')
    ).toBe(0)
  })
})

describe('@open-pencil/types/no-unknown-record-double-cast', () => {
  test('recognizes Record<string, unknown> from the TypeScript AST', async () => {
    const source = 'export const result = value as unknown as Record< string, unknown >'
    expect(await count('@open-pencil/types/no-unknown-record-double-cast', source)).toBe(1)
  })

  test('accepts a double cast to a named type', async () => {
    const source = 'export const result = value as unknown as Point'
    expect(await count('@open-pencil/types/no-unknown-record-double-cast', source)).toBe(0)
  })
})

describe('@open-pencil/types/no-broad-unknown-assertions', () => {
  const rule = '@open-pencil/types/no-broad-unknown-assertions'

  test.each([
    'export const result = value as Record<string, unknown>',
    'export const result = value as Record<string, unknown>[]',
    'export const result = value as { items: unknown[]; name: string }'
  ])('rejects %s', async (source) => {
    expect(await count(rule, source)).toBe(1)
  })

  test('accepts an assertion to a named type', async () => {
    expect(await count(rule, 'export const result = value as Settings')).toBe(0)
  })
})

describe('@open-pencil/types/no-duplicate-shapes', () => {
  const rule = '@open-pencil/types/no-duplicate-shapes'

  test('reports an interface and alias with the same members', async () => {
    const source = [
      'interface First { name: string; size: number }',
      'type Second = { size: number; name: string }'
    ].join('\n')
    expect(await count(rule, source)).toBe(1)
  })

  test('keeps distinct callback signatures apart', async () => {
    const source = [
      'interface First { handler: (value: string) => number; enabled: boolean }',
      'interface Second { handler: (value: number) => number; enabled: boolean }'
    ].join('\n')
    expect(await count(rule, source)).toBe(0)
  })

  test('keeps distinct index signatures apart', async () => {
    const source = [
      'interface First { [key: string]: number; size: number }',
      'interface Second { [key: number]: number; size: number }'
    ].join('\n')
    expect(await count(rule, source)).toBe(0)
  })
})

describe('@open-pencil/types/no-import-type-annotations', () => {
  test('rejects an inline import() type', async () => {
    const source = "export let value: import('./point').Point"
    expect(await count('@open-pencil/types/no-import-type-annotations', source)).toBe(1)
  })

  test('accepts a top-level import type', async () => {
    const source = "import type { Point } from './point'\nexport let value: Point"
    expect(await count('@open-pencil/types/no-import-type-annotations', source)).toBe(0)
  })
})

describe('@open-pencil/types/no-function-type', () => {
  test('rejects the Function type and accepts a signature', async () => {
    expect(await count('@open-pencil/types/no-function-type', 'export let handler: Function')).toBe(
      1
    )
    expect(
      await count('@open-pencil/types/no-function-type', 'export let handler: () => void')
    ).toBe(0)
  })
})

describe('@open-pencil/types/no-suppression-comments', () => {
  test.each(['// @ts-ignore', '// @ts-expect-error', '/* @ts-nocheck */'])(
    'rejects %s',
    async (comment) => {
      expect(
        await count('@open-pencil/types/no-suppression-comments', `${comment}\nexport const a = 1`)
      ).toBe(1)
    }
  )

  test('accepts other comments and @ts-check, which turns checking on', async () => {
    expect(
      await count('@open-pencil/types/no-suppression-comments', '// ts is fine\nexport const a = 1')
    ).toBe(0)
    expect(
      await count('@open-pencil/types/no-suppression-comments', '// @ts-check\nexport const a = 1')
    ).toBe(0)
  })
})
