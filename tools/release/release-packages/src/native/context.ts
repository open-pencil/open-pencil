import { join, resolve } from 'node:path'

import { releasePaths as packageReleasePaths } from '#release/workflow'
import * as v from 'valibot'

export const releaseTagSchema = v.pipe(v.string(), v.regex(/^v\d+\.\d+\.\d+$/))
export const commitSchema = v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/))
export const sha256Schema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))

export const identitySchema = v.object({
  tag: releaseTagSchema,
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
    version: releaseVersion(identity.tag),
    paths: desktopReleasePaths(root)
  }
}
