import { describe, expect, test } from 'bun:test'

import { packageContentDiagnostics } from '#package-quality/checks/contents'

describe('package contents', () => {
  test('a package built from its own source passes', () => {
    expect(packageContentDiagnostics('@x/a', ['index.js', 'vendor/lib/index.js'])).toEqual([])
  })

  test("another workspace package's source fails", () => {
    expect(packageContentDiagnostics('@x/a', ['packages/core/src/editor/index.d.ts'])).toEqual([
      {
        packageName: '@x/a',
        field: 'dist',
        message: "holds another workspace package's source under dist/packages; import its types"
      }
    ])
  })

  test('Windows separators are read as /', () => {
    expect(
      packageContentDiagnostics('@x/a', [
        'packages\\core\\src\\index.d.ts',
        'node_modules\\lib\\a.js'
      ])
    ).toHaveLength(2)
  })

  test('a node_modules folder fails', () => {
    expect(
      packageContentDiagnostics('@x/a', ['node_modules/.bun/lib/index.js']).map(
        ({ message }) => message
      )
    ).toEqual(['holds a copy of an installed package under node_modules; declare it and import it'])
  })
})
