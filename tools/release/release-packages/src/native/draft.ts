import * as v from 'valibot'

import type { ReleaseIdentity } from './context.ts'

export const releaseSchema = v.object({
  id: v.number(),
  tag_name: v.string(),
  draft: v.boolean(),
  assets: v.array(v.object({ name: v.string() }))
})

export function assertDraftReplacement(
  release: v.InferOutput<typeof releaseSchema> | undefined,
  names: string[],
  actualCommit: string,
  identity: ReleaseIdentity
): void {
  if (release && !release.draft) throw new Error('Refusing to replace a published release')
  if (actualCommit !== identity.sourceCommit)
    throw new Error('Release tag changed during the build')

  if (!names.includes('release-manifest.json') || !names.includes('SHA256SUMS')) {
    throw new Error('Missing release manifest')
  }

  const unexpected = release?.assets.filter((asset) => !names.includes(asset.name)) ?? []
  if (unexpected.length > 0) {
    throw new Error(
      `Refusing to remove unexpected draft assets: ${unexpected.map((asset) => asset.name).join(', ')}`
    )
  }
}
