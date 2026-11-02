import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  provenanceBundle,
  provenanceMismatches,
  provenanceStatement,
  releaseSignerIdentity,
  type ProvenanceStatement
} from '#release/provenance'

// npm's attestations for @open-pencil/emit@0.17.0-beta.1, published by the v0.17.0-beta.1 run.
const attestations = await readFile(
  join(import.meta.dir, 'fixtures/emit-attestations.json'),
  'utf8'
)
const source = {
  repository: 'open-pencil/open-pencil',
  tag: 'v0.17.0-beta.1',
  commit: 'a74fdc7e74126ff3a6062cb657b97a399fce34fc'
}
const integrity =
  'sha512-7gwFbI8p7mSWHNij7OaubC+M1Bw2NDD+Uw5KT2M6T9z6Sd7IvBTlQ8hYJSvqyItMHUYRIesKPlz1Sn4qtFeE7w=='

function published(): ProvenanceStatement {
  return provenanceStatement(provenanceBundle(attestations))
}

test('reads the SLSA provenance bundle and its statement from npm attestations', () => {
  const bundle = provenanceBundle(attestations)
  expect(bundle.mediaType).toBe('application/vnd.dev.sigstore.bundle.v0.3+json')
  const statement = provenanceStatement(bundle)
  expect(statement.predicate.runDetails.metadata.invocationId).toBe(
    'https://github.com/open-pencil/open-pencil/actions/runs/41425172592/attempts/1'
  )
  expect(provenanceMismatches(statement, integrity, source)).toEqual([])
})

test('names the release workflow at the tag as the signer', () => {
  expect(releaseSignerIdentity(source)).toBe(
    'https://github.com/open-pencil/open-pencil/.github/workflows/build.yml@refs/tags/v0.17.0-beta.1'
  )
})

test('refuses a version built from another commit or ref', () => {
  expect(
    provenanceMismatches(published(), integrity, { ...source, commit: 'b'.repeat(40) })
  ).toEqual([`built from commit ${source.commit}`])

  const statement = published()
  statement.predicate.buildDefinition.externalParameters.workflow.ref = 'refs/heads/master'
  expect(provenanceMismatches(statement, integrity, source)).toEqual([
    'built from refs/heads/master'
  ])
  expect(provenanceMismatches(published(), integrity, { ...source, tag: 'v0.16.0' })).toEqual([
    'built from refs/tags/v0.17.0-beta.1',
    'built from commit unknown'
  ])
})

test('refuses a version built by another workflow or repository', () => {
  const statement = published()
  statement.predicate.buildDefinition.externalParameters.workflow.path =
    '.github/workflows/chromium.yml'
  expect(provenanceMismatches(statement, integrity, source)).toEqual([
    'built by .github/workflows/chromium.yml'
  ])

  expect(
    provenanceMismatches(published(), integrity, { ...source, repository: 'someone/open-pencil' })
  ).toEqual(['built in https://github.com/open-pencil/open-pencil', 'built from commit unknown'])
})

test('refuses provenance for a different tarball than the registry serves', () => {
  const other = `sha512-${'A'.repeat(86)}==`
  expect(provenanceMismatches(published(), other, source)).toEqual([
    'attests a different tarball than the registry serves'
  ])
})

test('requires a well-formed SLSA provenance bundle', () => {
  const withoutSLSA = JSON.stringify({
    attestations: [{ predicateType: 'https://example.com/other', bundle: {} }]
  })
  expect(() => provenanceBundle(withoutSLSA)).toThrow('no SLSA provenance attestation')
  const malformed = JSON.stringify({
    attestations: [{ predicateType: 'https://slsa.dev/provenance/v1', bundle: { mediaType: 'x' } }]
  })
  expect(() => provenanceBundle(malformed)).toThrow()
  expect(() => provenanceBundle('{"attestations": "nope"}')).toThrow()
})
