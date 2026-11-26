import { writeFile } from 'node:fs/promises'

import { nightlyVersionSchema } from '#release/version'
import * as v from 'valibot'

/**
 * A nightly's release notes. Nightlies have no changelog section; they name the commit they
 * build, and the update window shows these notes as a release's.
 */
export function nightlyNotes(version: string, source: string, repository: string): string {
  v.parse(nightlyVersionSchema, version)
  return [
    `Nightly build ${version} of [\`${source.slice(0, 10)}\`](https://github.com/${repository}/commit/${source}) on master.`,
    '',
    'Nightlies are built every night from the newest code and can break. To go back, choose Stable in Settings → Updates → Update channel.',
    ''
  ].join('\n')
}

if (import.meta.main) {
  const [path] = process.argv.slice(2)
  const { RELEASE_VERSION, SOURCE_COMMIT, GITHUB_REPOSITORY } = process.env
  if (!path || !RELEASE_VERSION || !SOURCE_COMMIT || !GITHUB_REPOSITORY) {
    throw new Error(
      'Usage: notes.ts <path>, with RELEASE_VERSION, SOURCE_COMMIT, and GITHUB_REPOSITORY'
    )
  }
  await writeFile(path, nightlyNotes(RELEASE_VERSION, SOURCE_COMMIT, GITHUB_REPOSITORY))
}
