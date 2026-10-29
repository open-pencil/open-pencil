import { existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { groupBy, isPlainObject, uniq } from 'es-toolkit'
import ts from 'typescript'

import {
  discoverPublicPackages,
  type PackageDiagnostic
} from '@open-pencil/package-artifacts-tools'

/** The JSX automatic runtime requires both entries to export the same factory functions. */
const JSX_RUNTIME_ENTRIES = new Set(['./jsx-runtime', './jsx-dev-runtime'])

/** One name an entry exports, with the package and declaration it resolves to. */
export interface EntryExport {
  packageName: string
  entry: string
  name: string
  /** Declaring file relative to the workspace root, and the declared name. */
  declaration: string
  declaringPackage: string | undefined
}

function sourceOf(directory: string, target: unknown): string | null {
  if (typeof target === 'string') {
    if (target.includes('*') || target.endsWith('.json')) return null
    const path = target.replace(/^\.\/dist\//, './src/').replace(/\.(m?js|d\.m?ts)$/, '.ts')
    return existsSync(join(directory, path)) ? join(directory, path) : null
  }
  if (!target || typeof target !== 'object') return null
  for (const condition of ['bun', 'import', 'default', 'types']) {
    const source = sourceOf(directory, Reflect.get(target, condition))
    if (source) return source
  }
  return null
}

/** Every name each public package's entries export, resolved through re-exports. */
export async function collectEntryExports(root: string): Promise<EntryExport[]> {
  const packages = await discoverPublicPackages(root)
  const entries = packages.flatMap(({ directory, manifest }) =>
    Object.entries(isPlainObject(manifest.exports) ? manifest.exports : {}).flatMap(
      ([entry, target]) => {
        const file = sourceOf(join(root, directory), target)
        return file ? [{ packageName: manifest.name, entry, file }] : []
      }
    )
  )
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), (path) => ts.sys.readFile(path))
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const program = ts.createProgram({
    rootNames: entries.map(({ file }) => file),
    options: { ...options, noEmit: true, customConditions: ['bun'] }
  })
  const checker = program.getTypeChecker()
  const packageOf = (file: string) =>
    packages.find(({ directory }) => file.startsWith(join(root, directory) + sep))?.manifest.name

  return entries.flatMap(({ packageName, entry, file }) => {
    const source = program.getSourceFile(file)
    const module = source && checker.getSymbolAtLocation(source)
    if (!module) return []
    return checker.getExportsOfModule(module).map((symbol) => {
      const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
      const declaringFile = target.declarations?.[0]?.getSourceFile().fileName ?? file
      return {
        packageName,
        entry,
        name: symbol.getName(),
        declaration: `${relative(root, declaringFile)}#${target.getName()}`,
        declaringPackage: packageOf(declaringFile)
      }
    })
  })
}

/**
 * A package exports each of its names from one entry, and only names it declares itself:
 * consumers import another package's names from that package.
 */
export function entryExportDiagnostics(exports: EntryExport[]): PackageDiagnostic[] {
  const diagnostics: PackageDiagnostic[] = []
  for (const [packageName, own] of Object.entries(groupBy(exports, (row) => row.packageName))) {
    for (const row of own) {
      if (row.declaringPackage && row.declaringPackage !== packageName) {
        diagnostics.push({
          packageName,
          field: `exports["${row.entry}"]`,
          message: `re-exports ${row.name} from ${row.declaringPackage}; import it from there`
        })
      }
    }
    const shared = groupBy(
      own.filter((row) => !JSX_RUNTIME_ENTRIES.has(row.entry)),
      (row) => row.declaration
    )
    for (const rows of Object.values(shared)) {
      const entries = uniq(rows.map((row) => row.entry))
      if (entries.length < 2) continue
      diagnostics.push({
        packageName,
        field: 'exports',
        message: `${rows[0].name} is exported from ${entries.join(', ')}; keep one entry`
      })
    }
  }
  return diagnostics
}

export async function validateEntryExports(root: string): Promise<PackageDiagnostic[]> {
  return entryExportDiagnostics(await collectEntryExports(root))
}
