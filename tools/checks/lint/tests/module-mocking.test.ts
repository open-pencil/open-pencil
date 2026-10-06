import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-module-mocking'
const rules = { [`open-pencil/${rule}`]: 'error' }

describe('no-module-mocking', () => {
  test.each([
    "vi.mock('./store')",
    "jest['doMock']('./store')",
    "jest.unstable_mockModule('./store')",
    "import { vi as testAPI } from 'vitest'; testAPI.mock('./store')",
    "import { jest } from '@jest/globals'; jest.mock('./store')",
    "import { mock } from 'bun:test'; mock.module('./store', () => ({}))",
    "import { jest } from 'bun:test'; jest.mock('./store')",
    "import { jest as testAPI } from 'bun:test'; testAPI.mock('./store')",
    "import { vitest } from 'vitest'; vitest.mock('./store')",
    "import { mock as bunMock } from 'bun:test'; bunMock['module']('./store', () => ({}))"
  ])('rejects module registry mocking: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    "vi.spyOn(store, 'save')",
    'const vi = { mock() {} }; vi.mock()',
    'function test(jest: { mock(): void }) { jest.mock() }',
    "import { vi as localVi } from './helpers'; localVi.mock('./store')",
    'const mock = { module() {} }; mock.module()'
  ])('accepts scoped replacements and shadowed framework names: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
