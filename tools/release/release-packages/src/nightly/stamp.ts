import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { nightlyVersionSchema } from '#release/version'
import * as v from 'valibot'

/** Where a build reads its version: the editor from the root manifest, the bundles from Tauri's config. */
export const STAMPED_FILES = ['package.json', 'desktop/tauri.conf.json'] as const

const versionedSchema = v.pipe(v.string(), v.parseJson(), v.looseObject({ version: v.string() }))

/**
 * Writes a nightly's version into the build's checkout, which never commits it: master keeps the
 * version of the release it heads for, and a nightly is a build of it.
 */
export async function stampNightlyVersion(root: string, version: string): Promise<void> {
  v.parse(nightlyVersionSchema, version)
  for (const file of STAMPED_FILES) {
    const path = join(root, file)
    const manifest = v.parse(versionedSchema, await readFile(path, 'utf8'))
    await writeFile(path, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`)
  }
}

if (import.meta.main) {
  await stampNightlyVersion(process.cwd(), process.env.RELEASE_VERSION ?? '')
  console.log(`Stamped ${process.env.RELEASE_VERSION} into ${STAMPED_FILES.join(', ')}`)
}
