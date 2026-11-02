import { bundleFromJSON, bundleToJSON, type SerializedBundle } from '@sigstore/bundle'
import { decode, isValid, toUint8Array } from 'js-base64'
import { verify as verifySigstoreBundle } from 'sigstore'
import * as v from 'valibot'

import { NPM_RELEASE_POLICY } from './policy'

const SLSA_PROVENANCE = 'https://slsa.dev/provenance/v1'
const GITHUB_ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com'
export const RELEASE_WORKFLOW_PATH = '.github/workflows/build.yml'

/** The release a published npm version must have come from for a rerun to skip it. */
export interface ReleaseSource {
  /** `owner/name` on GitHub. */
  repository: string
  tag: string
  commit: string
}

const statementSchema = v.object({
  subject: v.array(
    v.object({ name: v.string(), digest: v.object({ sha512: v.optional(v.string()) }) })
  ),
  predicate: v.object({
    buildDefinition: v.object({
      externalParameters: v.object({
        workflow: v.object({ ref: v.string(), repository: v.string(), path: v.string() })
      }),
      resolvedDependencies: v.array(
        v.object({ uri: v.string(), digest: v.object({ gitCommit: v.optional(v.string()) }) })
      )
    }),
    runDetails: v.object({ metadata: v.object({ invocationId: v.string() }) })
  })
})

export type ProvenanceStatement = v.InferOutput<typeof statementSchema>

const attestationsSchema = v.object({
  attestations: v.array(v.object({ predicateType: v.string(), bundle: v.unknown() }))
})

const versionSchema = v.object({
  dist: v.object({ integrity: v.string(), tarball: v.pipe(v.string(), v.url()) })
})

/** An npm version this release already published, as the registry serves it. */
export interface PublishedReleaseVersion {
  /** The workflow run that published it. */
  run: string
  /** Subresource integrity of the tarball, `sha512-…`. */
  integrity: string
  tarball: string
}

/** The Sigstore bundle of the SLSA provenance in npm's attestations response for one version. */
export function provenanceBundle(text: string): SerializedBundle {
  const response = v.parse(v.pipe(v.string(), v.parseJson(), attestationsSchema), text)
  const provenance = response.attestations.find(
    (attestation) => attestation.predicateType === SLSA_PROVENANCE
  )
  if (!provenance) throw new Error('no SLSA provenance attestation')
  return bundleToJSON(bundleFromJSON(provenance.bundle))
}

/** The in-toto statement a provenance bundle signs. Read it only after verifying the bundle. */
export function provenanceStatement(bundle: SerializedBundle): ProvenanceStatement {
  const payload = bundle.dsseEnvelope?.payload
  if (!payload || !isValid(payload)) throw new Error('provenance bundle has no DSSE payload')
  return v.parse(v.pipe(v.string(), v.parseJson(), statementSchema), decode(payload))
}

/** The certificate identity GitHub Actions signs with for the release workflow at the tag. */
export function releaseSignerIdentity(source: ReleaseSource): string {
  return `https://github.com/${source.repository}/${RELEASE_WORKFLOW_PATH}@refs/tags/${source.tag}`
}

function integrityHex(integrity: string): string {
  const match = /^sha512-(.+)$/.exec(integrity)
  if (!match?.[1] || !isValid(match[1])) throw new Error(`unsupported integrity ${integrity}`)
  return Array.from(toUint8Array(match[1]), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Returns why `statement` does not show that the tarball with `integrity` was published by this
 * repository's release workflow from `source`'s tag and commit, or an empty list when it does.
 */
export function provenanceMismatches(
  statement: ProvenanceStatement,
  integrity: string,
  source: ReleaseSource
): string[] {
  const { workflow } = statement.predicate.buildDefinition.externalParameters
  const repositoryURL = `https://github.com/${source.repository}`
  const ref = `refs/tags/${source.tag}`
  const sourceDependency = statement.predicate.buildDefinition.resolvedDependencies.find(
    (dependency) => dependency.uri === `git+${repositoryURL}@${ref}`
  )
  const digest = integrityHex(integrity)
  const problems: string[] = []

  if (workflow.repository !== repositoryURL) problems.push(`built in ${workflow.repository}`)
  if (workflow.path !== RELEASE_WORKFLOW_PATH) problems.push(`built by ${workflow.path}`)
  if (workflow.ref !== ref) problems.push(`built from ${workflow.ref}`)
  if (sourceDependency?.digest.gitCommit !== source.commit) {
    problems.push(`built from commit ${sourceDependency?.digest.gitCommit ?? 'unknown'}`)
  }
  if (!statement.subject.some((subject) => subject.digest.sha512 === digest)) {
    problems.push('attests a different tarball than the registry serves')
  }
  return problems
}

class RegistryError extends Error {
  constructor(
    readonly status: number,
    path: string
  ) {
    super(`registry answered ${status} for ${path}`)
    this.name = 'RegistryError'
  }
}

async function registryText(path: string): Promise<string> {
  const response = await fetch(new URL(path, NPM_RELEASE_POLICY.registry))
  if (!response.ok) throw new RegistryError(response.status, path)
  return response.text()
}

/**
 * Checks that an already published `name@version` came from this release's tag through the release
 * workflow, so a rerun of that release can skip it instead of stopping. The provenance bundle's
 * signature, certificate and transparency-log entry are verified against the release workflow's
 * identity at the tag before its statement is read.
 */
export async function verifyPublishedFromRelease(
  name: string,
  version: string,
  source: ReleaseSource
): Promise<PublishedReleaseVersion> {
  const spec = `${name}@${version}`
  const encoded = name.replace('/', '%2f')
  const { dist } = v.parse(
    v.pipe(v.string(), v.parseJson(), versionSchema),
    await registryText(`${encoded}/${version}`)
  )
  const attestations = await registryText(`-/npm/v1/attestations/${encoded}@${version}`).catch(
    (error: unknown) => {
      if (error instanceof RegistryError && error.status === 404) {
        throw new Error(
          `${spec} has no provenance, so it cannot be verified as part of ${source.tag}`
        )
      }
      throw error
    }
  )
  const bundle = provenanceBundle(attestations)
  const signer = releaseSignerIdentity(source)
  await verifySigstoreBundle(bundle, {
    certificateIssuer: GITHUB_ACTIONS_ISSUER,
    certificateIdentityURI: signer
  }).catch((error: unknown) => {
    throw new Error(`${spec} provenance is not signed by ${signer}`, { cause: error })
  })
  const statement = provenanceStatement(bundle)
  const problems = provenanceMismatches(statement, dist.integrity, source)
  if (problems.length > 0) {
    throw new Error(`${spec} was not published by ${source.tag}: ${problems.join('; ')}`)
  }
  return {
    run: statement.predicate.runDetails.metadata.invocationId,
    integrity: dist.integrity,
    tarball: dist.tarball
  }
}
