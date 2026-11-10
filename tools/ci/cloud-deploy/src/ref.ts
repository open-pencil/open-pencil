import { runCommand } from '@open-pencil/package-artifacts-tools'

/** The Cloud deployments the Deploy Cloud workflow deploys. */
export const CLOUD_TARGETS = ['staging', 'production'] as const
export type CloudTarget = (typeof CLOUD_TARGETS)[number]

/** A release tag, as the release workflow pushes: `vX.Y.Z` or `vX.Y.Z-beta.N`. */
const RELEASE_TAG = /^refs\/tags\/v\d+\.\d+\.\d+(-beta\.\d+)?$/
const MASTER = 'refs/heads/master'

/**
 * Why a target may not deploy the ref, or nothing when it may. Staging deploys master or a
 * release; production only a release, so what serves people is code a release names.
 */
export function refusal(target: string, ref: string): string | undefined {
  if (!(CLOUD_TARGETS as readonly string[]).includes(target)) {
    return `Unknown Cloud target ${target}; expected one of ${CLOUD_TARGETS.join(', ')}`
  }
  if (RELEASE_TAG.test(ref)) return undefined
  if (target === 'staging') {
    return ref === MASTER ? undefined : `Staging deploys master or a release tag, not ${ref}`
  }
  return `Production deploys a release tag (vX.Y.Z), not ${ref}`
}

/**
 * Whether the checked-out commit is on master, so a tag pushed on any other branch deploys
 * nothing. Needs master's history, as a checkout with `fetch-depth: 0` has.
 */
export async function isOnMaster(cwd: string, execute = runCommand): Promise<boolean> {
  try {
    await execute({
      command: 'git',
      args: ['merge-base', '--is-ancestor', 'HEAD', 'origin/master'],
      cwd
    })
    return true
  } catch {
    return false
  }
}

if (import.meta.main) {
  const [target = ''] = process.argv.slice(2)
  const reason =
    refusal(target, process.env.GITHUB_REF ?? '') ??
    ((await isOnMaster(process.cwd())) ? undefined : 'The commit to deploy is not on master')
  if (reason) {
    console.error(reason)
    process.exit(1)
  }
}
