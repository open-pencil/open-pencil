import type * as v from 'valibot'

import type { packageManifestSchema } from './schema'

export type PackageManifest = v.InferOutput<typeof packageManifestSchema>

export interface WorkspacePackage {
  directory: string
  manifest: PackageManifest
}

export interface PackageDiagnostic {
  field: string
  message: string
  packageName: string
}
