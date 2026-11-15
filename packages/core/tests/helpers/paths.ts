import { dirname, join } from 'node:path'

/** A file inside this package, for assets that are not modules. */
export function corePackagePath(...segments: string[]): string {
  return join(
    dirname(Bun.resolveSync('@open-pencil/core/package.json', import.meta.dir)),
    ...segments
  )
}
