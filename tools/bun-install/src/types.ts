export type PackageData = {
  name: string
  dir: string
  bins: string[]
  localDeps: string[]
  hasBuildScript: boolean
  archivePath?: string // Populated after packing
}

export type SpawnOpts = { cwd?: string }

export const EXIT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const
