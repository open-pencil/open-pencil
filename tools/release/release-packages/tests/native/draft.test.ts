import { expect, test } from 'bun:test'

import type { ReleaseIdentity } from '#release/native/context'
import { assertDraftReplacement, releaseChannelArgs } from '#release/native/draft'

const identity: ReleaseIdentity = {
  tag: 'v0.15.0',
  sourceCommit: 'a'.repeat(40),
  workflowCommit: 'b'.repeat(40),
  runId: '123',
  runAttempt: '1',
  frontendSha256: 'c'.repeat(64)
}
const names = ['release-manifest.json', 'SHA256SUMS', 'installer.exe']
const draft = { id: 123, tag_name: identity.tag, draft: true, assets: [{ name: 'installer.exe' }] }

test('permits creating a draft or replacing its known assets', () => {
  expect(() =>
    assertDraftReplacement(undefined, names, identity.sourceCommit, identity)
  ).not.toThrow()
  expect(() => assertDraftReplacement(draft, names, identity.sourceCommit, identity)).not.toThrow()
})

test('refuses to modify a published release', () => {
  expect(() =>
    assertDraftReplacement({ ...draft, draft: false }, names, identity.sourceCommit, identity)
  ).toThrow('published release')
})

test('refuses a tag moved after artifact construction', () => {
  expect(() => assertDraftReplacement(draft, names, 'd'.repeat(40), identity)).toThrow(
    'tag changed'
  )
})

test('refuses to silently delete unexpected draft assets', () => {
  const unexpected = { ...draft, assets: [{ name: 'unrelated.zip' }] }
  expect(() => assertDraftReplacement(unexpected, names, identity.sourceCommit, identity)).toThrow(
    'unexpected draft assets'
  )
})

test('keeps the OpenPencil Chromium files added to the release', () => {
  const chromium = {
    ...draft,
    assets: [
      ...draft.assets,
      { name: 'OpenPencil-Chromium_0.15.0_aarch64.dmg' },
      { name: 'latest-chromium.json' }
    ]
  }
  expect(() =>
    assertDraftReplacement(chromium, names, identity.sourceCommit, identity)
  ).not.toThrow()
})

test.each(['release-manifest.json', 'SHA256SUMS'])('requires %s before publication', (missing) => {
  expect(() =>
    assertDraftReplacement(
      draft,
      names.filter((name) => name !== missing),
      identity.sourceCommit,
      identity
    )
  ).toThrow('Missing release manifest')
})

test('marks a beta as a pre-release that never becomes the latest release', () => {
  expect(releaseChannelArgs('0.16.0-beta.1')).toEqual(['--prerelease', '--latest=false'])
  expect(releaseChannelArgs('0.16.0')).toEqual([])
})
