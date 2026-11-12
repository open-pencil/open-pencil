import { expect, test } from 'bun:test'

import { emptyDriftFile, type DriftFile, type DriftReference } from '@/app/live-pages/drift/schema'
import {
  mergeBaselines,
  parseSidecar,
  sidecarOf,
  sidecarText
} from '@/app/live-pages/drift/sidecar/model'

function referenceOf(nodeId: string, capturedAt: string, digest = 'a'.repeat(64)): DriftReference {
  return {
    nodeId,
    url: 'http://localhost:3000/pricing',
    capturedAt,
    width: 1440,
    height: 900,
    digest
  }
}

function fileWith(references: Record<string, DriftReference>): DriftFile {
  return { version: 1, references }
}

test('a sidecar names the document its pictures were taken from', () => {
  const file = fileWith({ a: referenceOf('a', '2026-11-09T12:00:00.000Z') })

  expect(sidecarOf(file, 'dashboard.pen').document).toBe('dashboard.pen')
  expect(sidecarOf(file, null).document).toBeUndefined()
})

test('frames are written in name order, so a commit diffs by its baselines', () => {
  const text = sidecarText(
    fileWith({
      zebra: referenceOf('zebra', '2026-11-09T12:00:00.000Z'),
      alpha: referenceOf('alpha', '2026-11-09T11:00:00.000Z')
    })
  )

  expect(text.indexOf('"alpha"')).toBeLessThan(text.indexOf('"zebra"'))
  expect(text.endsWith('\n')).toBe(true)
  expect(JSON.parse(text).version).toBe(1)
})

test('the order is the code unit order every machine shares', () => {
  // A collator that follows the runtime's language may weigh punctuation differently, which would
  // make the same baselines produce a different file on another machine.
  const text = sidecarText(
    fileWith({
      'a:b': referenceOf('a:b', '2026-11-09T12:00:00.000Z'),
      'a-b': referenceOf('a-b', '2026-11-09T12:00:00.000Z')
    })
  )

  expect(text.indexOf('"a-b"')).toBeLessThan(text.indexOf('"a:b"'))
})

test('a sidecar reads back with what it was written from', () => {
  const file = fileWith({ frame: referenceOf('frame', '2026-11-09T12:00:00.000Z') })
  const read = parseSidecar(sidecarText(sidecarOf(file, 'site.pen')))

  expect(read.document).toBe('site.pen')
  expect(read.references).toEqual(file.references)
})

test('a picture written by an older version is dropped and the rest is kept', () => {
  const read = parseSidecar(
    JSON.stringify({
      version: 1,
      document: 'site.pen',
      references: {
        kept: referenceOf('kept', '2026-11-09T12:00:00.000Z'),
        broken: { nodeId: 'broken' },
        unreadable: 'not a picture'
      }
    })
  )

  expect(Object.keys(read.references)).toEqual(['kept'])
  expect(read.document).toBe('site.pen')
})

test('a file that is not a sidecar holds no baselines', () => {
  const warnings: unknown[] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    expect(parseSidecar('not json at all').references).toEqual({})
  } finally {
    console.warn = original
  }
  // A JSON value that is not an object names no pictures, which needs no warning of its own.
  expect(warnings).toHaveLength(1)
  expect(parseSidecar('[]').references).toEqual({})
})

test('a sidecar without a document name, or without pictures, is still read', () => {
  // A document never saved has no name to record, and a project may hold an empty sidecar.
  expect(parseSidecar('{"version":1}').references).toEqual({})
  expect(parseSidecar('{"version":1,"references":{}}')).toEqual({ version: 1, references: {} })
  expect(
    parseSidecar(JSON.stringify({ version: 1, references: { a: { nodeId: 'a' } } })).references
  ).toEqual({})
})

test('a picture the document lacks is taken from the project', () => {
  const document = emptyDriftFile()
  const sidecar = parseSidecar(
    sidecarText(fileWith({ framed: referenceOf('framed', '2026-11-09T12:00:00.000Z') }))
  )

  expect(mergeBaselines(document, sidecar).references).toEqual(sidecar.references)
})

test('a frame both hold keeps whichever picture was taken later', () => {
  const later = referenceOf('frame', '2026-11-09T15:00:00.000Z', 'b'.repeat(64))
  const earlier = referenceOf('frame', '2026-11-09T09:00:00.000Z', 'c'.repeat(64))

  const fromProject = mergeBaselines(fileWith({ frame: earlier }), {
    version: 1,
    references: { frame: later }
  })
  expect(fromProject.references.frame.digest).toBe('b'.repeat(64))

  const fromDocument = mergeBaselines(fileWith({ frame: later }), {
    version: 1,
    references: { frame: earlier }
  })
  expect(fromDocument.references.frame.digest).toBe('b'.repeat(64))
})
