import { describe, expect, test } from 'bun:test'

import { lint, lintFiles, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

function on(rule: string) {
  return { [rule]: 'error' }
}

async function count(rule: string, source: string, path?: string): Promise<number> {
  return ruleDiagnostics(await lint(source, on(rule), path), rule).length
}

describe('@open-pencil/runtime/no-inline-delay', () => {
  const rule = '@open-pencil/runtime/no-inline-delay'

  test('rejects a duration written in place', async () => {
    for (const source of [
      'setTimeout(run, 3000)',
      'window.setTimeout(run, 30 * 1000)',
      'setInterval(tick, 500)',
      'setTimeout(run, 60 * 60 * 1000)',
      "import { setTimeout } from 'node:timers/promises'\nawait setTimeout(1000)",
      'fetch(url, { signal: AbortSignal.timeout(10_000) })'
    ]) {
      expect(await count(rule, source)).toBe(1)
    }
  })

  test('accepts a named duration, and zero, which only yields', async () => {
    for (const source of [
      'const TICK_MS = 500\nsetInterval(tick, TICK_MS)',
      'setTimeout(run, 0)',
      'setTimeout(run)',
      'const hex = byte.toString(16)',
      'AbortSignal.timeout(DEADLINE_MS.request)'
    ]) {
      expect(await count(rule, source)).toBe(0)
    }
  })
})

describe('@open-pencil/runtime/no-math-random', () => {
  test('rejects Math.random()', async () => {
    expect(
      await count('@open-pencil/runtime/no-math-random', 'export const pick = Math.random()')
    ).toBe(1)
  })

  test('accepts crypto.getRandomValues()', async () => {
    const source = 'export const bytes = crypto.getRandomValues(new Uint8Array(4))'
    expect(await count('@open-pencil/runtime/no-math-random', source)).toBe(0)
  })
})

describe('@open-pencil/runtime/no-silent-catch', () => {
  test('rejects an empty catch block', async () => {
    expect(await count('@open-pencil/runtime/no-silent-catch', 'try { run() } catch {}')).toBe(1)
    expect(
      await count('@open-pencil/runtime/no-silent-catch', 'try { run() } catch (error) { ; }')
    ).toBe(1)
  })

  test('accepts a catch block that handles the error', async () => {
    const source = 'try { run() } catch (error) { console.warn(error) }'
    expect(await count('@open-pencil/runtime/no-silent-catch', source)).toBe(0)
  })
})

describe('@open-pencil/runtime/no-reflect-delete-global-this-outside-tests', () => {
  const rule = '@open-pencil/runtime/no-reflect-delete-global-this-outside-tests'
  const source = "Reflect.deleteProperty(globalThis, 'fetch')"

  test('rejects deleting a global outside tests and accepts it in tests', async () => {
    const diagnostics = ruleDiagnostics(
      await lintFiles({ 'src/setup.ts': source, 'tests/setup.ts': source }, on(rule)),
      rule
    )
    expect(diagnostics.map((diagnostic) => diagnostic.filename?.endsWith('src/setup.ts'))).toEqual([
      true
    ])
  })

  test('accepts deleting from another object', async () => {
    expect(await count(rule, "Reflect.deleteProperty(cache, 'fetch')")).toBe(0)
  })
})

describe('@open-pencil/runtime/no-conditional-object-spreads', () => {
  const rule = '@open-pencil/runtime/no-conditional-object-spreads'

  test('accepts a simple one-property projection', async () => {
    const source = 'export const result = { ...(enabled ? { value: 1 } : {}) }'
    expect(await count(rule, source)).toBe(0)
  })

  test('reports a multi-property conditional projection', async () => {
    const source = 'export const result = { ...(enabled ? { value: 1, label: "yes" } : {}) }'
    expect(await count(rule, source)).toBe(1)
  })

  test('reports multiple conditional projections in one object', async () => {
    const source =
      'export const result = { ...(first ? { a: 1 } : {}), ...(second ? { b: 2 } : {}) }'
    expect(await count(rule, source)).toBe(2)
  })
})
