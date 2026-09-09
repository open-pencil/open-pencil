// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream pkg-types export name.
import type { PackageJson as PackageJSON } from 'pkg-types'

export interface PackageManifest
  extends
    Pick<
      PackageJSON,
      | 'private'
      | 'files'
      | 'main'
      | 'types'
      | 'bin'
      | 'scripts'
      | 'dependencies'
      | 'devDependencies'
      | 'peerDependencies'
      | 'optionalDependencies'
    >,
    Record<string, unknown> {
  name: string
  version: string
  exports?: unknown
  imports?: unknown
  publishConfig?: Record<string, unknown>
}

export interface WorkspacePackage {
  directory: string
  manifest: PackageManifest
}

export interface PackageDiagnostic {
  field: string
  message: string
  packageName: string
}
