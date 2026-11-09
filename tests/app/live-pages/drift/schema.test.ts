import { expect, test } from 'bun:test'

import { compareReference, digestOf } from '@/app/live-pages/drift/compare'
import {
  emptyDriftFile,
  parseDriftFile,
  withReference,
  type DriftReference
} from '@/app/live-pages/drift/schema'

const digest = 'a'.repeat(64)

function reference(overrides: Partial<DriftReference> = {}): DriftReference {
  return {
    nodeId: 'frame-1',
    url: 'http://localhost:3000/pricing',
    capturedAt: '2026-11-09T12:00:00.000Z',
    width: 1440,
    height: 900,
    digest,
    ...overrides
  }
}

test('a picture has one digest, whatever the bytes are', async () => {
  const first = await digestOf(new TextEncoder().encode('page'))
  const again = await digestOf(new TextEncoder().encode('page'))
  const other = await digestOf(new TextEncoder().encode('other'))
  expect(first).toBe(again)
  expect(first).not.toBe(other)
  expect(first).toMatch(/^[0-9a-f]{64}$/)
})

test('a page without a baseline has nothing to compare', () => {
  expect(compareReference(undefined, digest)).toBe('none')
})

test('a page with the same picture is unchanged, and a different one drifted', () => {
  expect(compareReference(reference(), digest)).toBe('same')
  expect(compareReference(reference(), 'b'.repeat(64))).toBe('changed')
})

test('a baseline file keeps one entry per frame, and a replacement wins', () => {
  const file = withReference(emptyDriftFile(), reference())
  expect(Object.keys(file.references)).toEqual(['frame-1'])
  const replaced = withReference(file, reference({ digest: 'c'.repeat(64) }))
  expect(replaced.references['frame-1']?.digest).toBe('c'.repeat(64))
})

test('a malformed baseline file loses only what it cannot read', () => {
  expect(parseDriftFile('not json')).toEqual(emptyDriftFile())
  const partial = JSON.stringify({
    version: 2,
    references: { good: reference(), bad: { nodeId: 'bad' } }
  })
  expect(Object.keys(parseDriftFile(partial).references)).toEqual(['good'])
})
