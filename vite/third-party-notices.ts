import type { Plugin } from 'vite'

import {
  bundledPackages,
  javascriptNotices
} from '@open-pencil/release-packages-tools/notices/javascript'

/** Where the build writes the notices, in its output directory. */
export const THIRD_PARTY_NOTICES = 'THIRD-PARTY-NOTICES.md'

/**
 * Writes `THIRD-PARTY-NOTICES.md` into the build with the license of every npm package it
 * bundles, which the licenses ask a redistributed bundle to carry. `worker` goes in the workers'
 * plugins, so the packages only a worker bundles are listed too; workers are bundled before the
 * page that loads them is written.
 */
export function thirdPartyNoticesPlugins(): { page: Plugin; worker: () => Plugin } {
  const moduleIds = new Set<string>()
  const record = (bundle: Parameters<NonNullable<Plugin['generateBundle']>>[1]) => {
    for (const output of Object.values(bundle)) {
      if (output.type === 'chunk') for (const id of output.moduleIds) moduleIds.add(id)
    }
  }
  return {
    worker: () => ({
      name: 'open-pencil-third-party-notices-worker',
      generateBundle(_, bundle) {
        record(bundle)
      }
    }),
    page: {
      name: 'open-pencil-third-party-notices',
      apply: 'build',
      async generateBundle(_, bundle) {
        record(bundle)
        this.emitFile({
          type: 'asset',
          fileName: THIRD_PARTY_NOTICES,
          source: javascriptNotices(await bundledPackages(moduleIds))
        })
      }
    }
  }
}
