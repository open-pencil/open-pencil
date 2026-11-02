import { expect, test } from 'bun:test'

import { parseProvenanceStatement, provenanceMismatches } from '#release/provenance'
import { encode } from 'js-base64'

// Values from @open-pencil/emit@0.17.0-beta.1, published by the v0.17.0-beta.1 release run.
const source = {
  repository: 'open-pencil/open-pencil',
  tag: 'v0.17.0-beta.1',
  commit: 'a74fdc7e74126ff3a6062cb657b97a399fce34fc'
}
const integrity =
  'sha512-7gwFbI8p7mSWHNij7OaubC+M1Bw2NDD+Uw5KT2M6T9z6Sd7IvBTlQ8hYJSvqyItMHUYRIesKPlz1Sn4qtFeE7w=='
const sha512 =
  'ee0c056c8f29ee64961cd8a3ece6ae6c2f8cd41c363430fe530e4a4f633a4fdcfa49dec8bc14e543c858252beac88b4c1d461121eb0a3e5cf54a7e2ab45784ef'

function statement({
  ref = 'refs/tags/v0.17.0-beta.1',
  path = '.github/workflows/build.yml',
  repository = 'https://github.com/open-pencil/open-pencil',
  commit = source.commit,
  digest = sha512
} = {}) {
  return {
    subject: [{ name: 'pkg:npm/%40open-pencil/emit@0.17.0-beta.1', digest: { sha512: digest } }],
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: { ref, repository, path } },
        resolvedDependencies: [{ uri: `git+${repository}@${ref}`, digest: { gitCommit: commit } }]
      },
      runDetails: {
        metadata: {
          invocationId:
            'https://github.com/open-pencil/open-pencil/actions/runs/41425172592/attempts/1'
        }
      }
    }
  }
}

function attestations(payload: unknown, predicateType = 'https://slsa.dev/provenance/v1') {
  return JSON.stringify({
    attestations: [
      {
        predicateType: 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1',
        bundle: { dsseEnvelope: { payload: encode(JSON.stringify({ subject: [] })) } }
      },
      { predicateType, bundle: { dsseEnvelope: { payload: encode(JSON.stringify(payload)) } } }
    ]
  })
}

test('accepts a version the release workflow published from the tag', () => {
  const parsed = parseProvenanceStatement(attestations(statement()))
  expect(provenanceMismatches(parsed, integrity, source)).toEqual([])
})

test('refuses a version built from another commit or ref', () => {
  const other = parseProvenanceStatement(attestations(statement({ commit: 'b'.repeat(40) })))
  expect(provenanceMismatches(other, integrity, source)).toEqual([
    `built from commit ${'b'.repeat(40)}`
  ])

  const dispatched = parseProvenanceStatement(attestations(statement({ ref: 'refs/heads/master' })))
  expect(provenanceMismatches(dispatched, integrity, source)).toEqual([
    'built from refs/heads/master',
    'built from commit unknown'
  ])
})

test('refuses a version built by another workflow or repository', () => {
  const workflow = parseProvenanceStatement(
    attestations(statement({ path: '.github/workflows/chromium.yml' }))
  )
  expect(provenanceMismatches(workflow, integrity, source)).toEqual([
    'built by .github/workflows/chromium.yml'
  ])

  const fork = parseProvenanceStatement(
    attestations(statement({ repository: 'https://github.com/someone/open-pencil' }))
  )
  expect(provenanceMismatches(fork, integrity, source)).toEqual([
    'built in https://github.com/someone/open-pencil',
    'built from commit unknown'
  ])
})

test('refuses provenance for a different tarball than the registry serves', () => {
  const parsed = parseProvenanceStatement(attestations(statement({ digest: 'c'.repeat(128) })))
  expect(provenanceMismatches(parsed, integrity, source)).toEqual([
    'attests a different tarball than the registry serves'
  ])
})

test('requires a SLSA provenance attestation', () => {
  expect(() =>
    parseProvenanceStatement(attestations(statement(), 'https://example.com/other'))
  ).toThrow('no SLSA provenance attestation')
  expect(() => parseProvenanceStatement('{"attestations": "nope"}')).toThrow()
})
