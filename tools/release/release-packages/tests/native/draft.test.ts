import { expect, test } from 'bun:test'

import type { ReleaseIdentity } from '#release/native/context'
import { assertDraftReplacement } from '#release/native/draft'

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
