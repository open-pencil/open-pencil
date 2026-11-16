import { join, resolve } from 'node:path'

import {
  isNightlyVersion,
  NIGHTLY_TAG,
  nightlyVersionSchema,
  releaseTagSchema,
  releaseVersionSchema
} from '#release/version'
import { releasePaths as packageReleasePaths } from '#release/workflow'
import * as v from 'valibot'

export const commitSchema = v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/))
export const sha256Schema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))

export const identitySchema = v.object({
  /** A release's `vX.Y.Z` tag, or the rolling nightly release's. */
  tag: v.union([releaseTagSchema, v.literal(NIGHTLY_TAG)]),
  version: v.union([releaseVersionSchema, nightlyVersionSchema]),
  sourceCommit: commitSchema,
  workflowCommit: commitSchema,
  runId: v.pipe(v.string(), v.regex(/^\d+$/)),
  runAttempt: v.pipe(v.string(), v.regex(/^\d+$/)),
  frontendSha256: sha256Schema
})

export type ReleaseIdentity = v.InferOutput<typeof identitySchema>

export function releaseVersion(tag: string): string {
  return v.parse(releaseTagSchema, tag).slice(1)
}

/**
 * The version a build carries: a release's from its tag, a nightly's from `RELEASE_VERSION`,
 * which the plan computed. Refuses a version the tag does not name.
 */
export function buildVersion(tag: string | undefined, version: string | undefined): string {
  if (tag === NIGHTLY_TAG) {
    if (!version || !isNightlyVersion(version)) throw new Error(`Not a nightly version: ${version}`)
    return version
  }
  const tagged = releaseVersion(tag ?? '')
  if (version !== undefined && version !== tagged) {
    throw new Error(`Release ${tag} cannot build version ${version}`)
  }
  return tagged
}

export function isNightly(identity: Pick<ReleaseIdentity, 'tag'>): boolean {
  return identity.tag === NIGHTLY_TAG
}

export function desktopReleasePaths(root: string) {
  const absoluteRoot = resolve(root)

  return {
    root: absoluteRoot,
    nativeOutput: join(absoluteRoot, 'native-output'),
    nativeArtifacts: join(absoluteRoot, 'native-artifacts'),
    output: join(absoluteRoot, 'release-output'),
    packages: packageReleasePaths(absoluteRoot).artifacts,
    notes: join(absoluteRoot, 'release-notes.md'),
    tauriConfig: join(absoluteRoot, 'desktop', 'tauri.conf.json')
  }
}

export function createReleaseContext(env: NodeJS.ProcessEnv = process.env, root = process.cwd()) {
  const identity = v.parse(identitySchema, {
    tag: env.RELEASE_TAG,
    version: buildVersion(env.RELEASE_TAG, env.RELEASE_VERSION || undefined),
    sourceCommit: env.SOURCE_COMMIT,
    workflowCommit: env.WORKFLOW_COMMIT,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    frontendSha256: env.FRONTEND_SHA256
  })
  const repository = v.parse(
    v.pipe(v.string(), v.regex(/^[\w.-]+\/[\w.-]+$/)),
    env.GITHUB_REPOSITORY
  )

  return {
    identity,
    repository,
    version: identity.version,
    paths: desktopReleasePaths(root)
  }
}
