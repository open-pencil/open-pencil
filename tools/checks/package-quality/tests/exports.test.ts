import { describe, expect, test } from 'bun:test'

import { entryExportDiagnostics, type EntryExport } from '#package-quality/checks/exports'

function row(entry: string, name: string, declaration: string, declaringPackage = '@x/a') {
  return { packageName: '@x/a', entry, name, declaration, declaringPackage } satisfies EntryExport
}

describe('entry exports', () => {
  test('a name exported from one entry passes', () => {
    expect(
      entryExportDiagnostics([row('.', 'Graph', 'a.ts#Graph'), row('./color', 'mix', 'c.ts#mix')])
    ).toEqual([])
  })

  test('a name reachable from two entries fails', () => {
    expect(
      entryExportDiagnostics([row('.', 'mix', 'c.ts#mix'), row('./color', 'mix', 'c.ts#mix')])
    ).toEqual([
      {
        packageName: '@x/a',
        field: 'exports',
        message: 'mix is exported from ., ./color; keep one entry'
      }
    ])
  })

  test('the two JSX runtime entries may share their factories', () => {
    expect(
      entryExportDiagnostics([
        row('.', 'renderJSX', 'r.ts#renderJSX'),
        row('./jsx-runtime', 'jsx', 'r.ts#jsx'),
        row('./jsx-dev-runtime', 'jsx', 'r.ts#jsx')
      ])
    ).toEqual([])
  })

  test("another package's name fails", () => {
    expect(entryExportDiagnostics([row('.', 'Color', 'b.ts#Color', '@x/b')])).toEqual([
      {
        packageName: '@x/a',
        field: 'exports["."]',
        message: 're-exports Color from @x/b; import it from there'
      }
    ])
  })
})
