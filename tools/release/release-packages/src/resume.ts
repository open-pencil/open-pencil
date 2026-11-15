import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

import {
  verifyPublishedFromRelease,
  type PublishedReleaseVersion,
  type ReleaseSource
} from './provenance'
import {
  artifactsByPackage,
  createPublicationPlan,
  releasePaths,
  type PublicationPlanEntry
} from './workflow'

/** Subresource integrity of `bytes`, in npm's `sha512-…` form. */
export function tarballIntegrity(bytes: Uint8Array): string {
  return `sha512-${fromUint8Array(new Uint8Array(createHash('sha512').update(bytes).digest()))}`
}

export interface ResumeOperations {
  plan(root: string): Promise<PublicationPlanEntry[]>
  artifacts(directory: string): Promise<Map<string, string>>
  verify(name: string, version: string, source: ReleaseSource): Promise<PublishedReleaseVersion>
  download(url: string): Promise<Uint8Array>
  write(path: string, bytes: Uint8Array): Promise<void>
}

async function downloadTarball(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} downloading ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

const resumeOperations: ResumeOperations = {
  plan: createPublicationPlan,
  artifacts: artifactsByPackage,
  verify: verifyPublishedFromRelease,
  download: downloadTarball,
  write: writeFile
}

/**
 * Resumes a release whose npm publication stopped partway. Every version already on npm must have
 * been published by this release's tag (by its provenance); its rebuilt tarball is replaced with
 * the registry's exact bytes, so the release manifest attests what npm serves and publication
 * skips it. A rebuild can differ from the published bytes, as in the order of a union type.
 */
export async function adoptPublishedReleaseArtifacts(
  root: string,
  source: ReleaseSource,
  operations: ResumeOperations = resumeOperations
): Promise<string[]> {
  const plan = await operations.plan(root)
  const artifacts = await operations.artifacts(releasePaths(root).artifacts)
  const adopted: string[] = []

  for (const { package: pkg } of plan.filter((entry) => entry.status === 'published')) {
    const { name, version } = pkg.manifest
    const spec = `${name}@${version}`
    const path = artifacts.get(spec)
    if (!path) throw new Error(`Missing release artifact for published ${spec}`)
    const published = await operations.verify(name, version, source)
    const bytes = await operations.download(published.tarball)
    if (tarballIntegrity(bytes) !== published.integrity) {
      throw new Error(`Registry tarball for ${spec} does not match its integrity`)
    }
    await operations.write(path, bytes)
    console.log(`${spec} was published by ${published.run}; using the registry's tarball`)
    adopted.push(spec)
  }
  return adopted
}

/** Fails unless every version already on npm is this tag's and its local tarball is npm's. */
export async function assertPublishedReleaseArtifacts(
  root: string,
  source: ReleaseSource,
  operations: Pick<ResumeOperations, 'plan' | 'artifacts' | 'verify'> = resumeOperations
): Promise<void> {
  const plan = await operations.plan(root)
  const artifacts = await operations.artifacts(releasePaths(root).artifacts)

  for (const { package: pkg } of plan.filter((entry) => entry.status === 'published')) {
    const { name, version } = pkg.manifest
    const spec = `${name}@${version}`
    const path = artifacts.get(spec)
    if (!path) throw new Error(`Missing release artifact for published ${spec}`)
    const published = await operations.verify(name, version, source)
    if (tarballIntegrity(await readFile(path)) !== published.integrity) {
      throw new Error(`${spec} is already published with other bytes; run release-packages resume`)
    }
  }
}

const releaseSourceEnvSchema = v.object({
  RELEASE_TAG: v.string(),
  SOURCE_COMMIT: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/)),
  GITHUB_REPOSITORY: v.pipe(v.string(), v.regex(/^[\w.-]+\/[\w.-]+$/))
})

/** The release a CI run builds, from the variables `build.yml` sets. */
export function releaseSourceFromEnv(env: NodeJS.ProcessEnv = process.env): ReleaseSource {
  const parsed = v.parse(releaseSourceEnvSchema, env)
  return {
    repository: parsed.GITHUB_REPOSITORY,
    tag: parsed.RELEASE_TAG,
    commit: parsed.SOURCE_COMMIT
  }
}
