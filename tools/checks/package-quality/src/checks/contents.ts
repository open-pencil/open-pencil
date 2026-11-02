import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import {
  discoverPublicPackages,
  type PackageDiagnostic
} from '@open-pencil/package-artifacts-tools'

/**
 * Build output a package must not ship: another workspace package's source, which copies that
 * package's types into this one instead of importing them, and a `node_modules` folder, a copy
 * of an installed package that should be a dependency the package imports.
 */
export function packageContentDiagnostics(
  packageName: string,
  files: readonly string[]
): PackageDiagnostic[] {
  const paths = files.map((file) => file.replaceAll('\\', '/'))
  const diagnostics: PackageDiagnostic[] = []
  if (paths.some((file) => file.startsWith('packages/'))) {
    diagnostics.push({
      packageName,
      field: 'dist',
      message: "holds another workspace package's source under dist/packages; import its types"
    })
  }
  if (paths.some((file) => file.split('/').includes('node_modules'))) {
    diagnostics.push({
      packageName,
      field: 'dist',
      message: 'holds a copy of an installed package under node_modules; declare it and import it'
    })
  }
  return diagnostics
}

async function builtFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { recursive: true, withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1))
  } catch (error) {
    // A package not built yet has nothing to check; Publint reports the missing entries.
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
}

export async function validatePackageContents(root: string): Promise<PackageDiagnostic[]> {
  const packages = await discoverPublicPackages(root)
  const diagnostics = await Promise.all(
    packages.map(async ({ directory, manifest }) =>
      packageContentDiagnostics(manifest.name, await builtFiles(join(root, directory, 'dist')))
    )
  )
  return diagnostics.flat()
}
