import { expect, test } from 'bun:test'

import { desktopAssets, desktopTargets } from '#release/native/catalog'
import { releaseVersion, type ReleaseIdentity } from '#release/native/context'
import { validateTargetManifests, type TargetManifest } from '#release/native/manifest'

const identity: ReleaseIdentity = {
  tag: 'v0.15.0',
  sourceCommit: 'a'.repeat(40),
  workflowCommit: 'b'.repeat(40),
  runId: '123',
  runAttempt: '1',
  frontendSha256: 'c'.repeat(64)
}

function manifests(): TargetManifest[] {
  return desktopTargets.map((target) => ({
    ...identity,
    target,
    files: desktopAssets(target, releaseVersion(identity.tag))
      .flatMap((asset) => (asset.signed ? [asset.name, `${asset.name}.sig`] : [asset.name]))
      .map((name) => ({ name, sha256: 'd'.repeat(64), size: 100 }))
  }))
}

test('accepts the complete release set regardless of file order', () => {
  const input = manifests().map((manifest) => ({ ...manifest, files: manifest.files.toReversed() }))

  expect(validateTargetManifests(input, identity)).toHaveLength(desktopTargets.length)
})

test.each([
  { ...identity, sourceCommit: 'e'.repeat(40) },
  { ...identity, workflowCommit: 'e'.repeat(40) },
  { ...identity, frontendSha256: 'e'.repeat(64) },
  { ...identity, tag: 'v0.15.1' },
  { ...identity, runId: '124' },
  { ...identity, runAttempt: '2' }
])('rejects mixed release identity %#', (other) => {
  expect(() => validateTargetManifests(manifests(), other)).toThrow('Mismatched release identity')
})

test('rejects duplicate targets even with a complete matrix count', () => {
  const input = manifests()
  const first = input[0]
  if (!first) throw new Error('Missing fixture')

  input[1] = structuredClone(first)

  expect(() => validateTargetManifests(input, identity)).toThrow('Duplicate native target')
})

test('rejects duplicate filenames instead of treating arrays as sets', () => {
  const input = manifests()
  const first = input[0]
  const file = first?.files[0]
  if (!first || !file) throw new Error('Missing fixture')

  first.files.push({ ...file })

  expect(() => validateTargetManifests(input, identity)).toThrow('Invalid assets')
})

test('rejects missing updater signatures', () => {
  const input = manifests().map((manifest) => ({
    ...manifest,
    files: manifest.files.filter((file) => !file.name.endsWith('.sig'))
  }))

  expect(() => validateTargetManifests(input, identity)).toThrow('Invalid assets')
})
