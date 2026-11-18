import { runCommand } from '@open-pencil/package-artifacts-tools'

/** The Cloud deployments the Deploy Cloud workflow deploys. */
export const CLOUD_TARGETS = ['staging', 'production'] as const
export type CloudTarget = (typeof CLOUD_TARGETS)[number]

export function isCloudTarget(value: string): value is CloudTarget {
  return (CLOUD_TARGETS as readonly string[]).includes(value)
}

/** A release tag, as the release workflow pushes: `vX.Y.Z` or `vX.Y.Z-beta.N`. */
const RELEASE_TAG = /^refs\/tags\/v\d+\.\d+\.\d+(-beta\.\d+)?$/
const MASTER = 'refs/heads/master'

/**
 * Why a target may not be deployed from the ref, or nothing when it may: master or a release
 * tag. Staging deploys that ref's commit; production promotes whatever staging runs
 * (`commit.ts`), so the ref only names the workflow version that does it.
 */
export function refusal(target: string, ref: string): string | undefined {
  if (!isCloudTarget(target)) {
    return `Unknown Cloud target ${target}; expected one of ${CLOUD_TARGETS.join(', ')}`
  }
  if (RELEASE_TAG.test(ref) || ref === MASTER) return undefined
  return `Cloud deploys from master or a release tag (vX.Y.Z), not ${ref}`
}

/**
 * Whether a commit is on master, so a tag pushed on any other branch deploys nothing. Needs
 * master's history, as a checkout with `fetch-depth: 0` has.
 */
export async function isOnMaster(
  cwd: string,
  commit = 'HEAD',
  execute = runCommand
): Promise<boolean> {
  try {
    await execute({
      command: 'git',
      args: ['merge-base', '--is-ancestor', commit, 'origin/master'],
      cwd
    })
    return true
  } catch {
    return false
  }
}
