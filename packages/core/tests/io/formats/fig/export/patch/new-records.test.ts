import { expect, setDefaultTimeout, test } from 'bun:test'

import { open } from '#core-tests/helpers/fig/archive'
import { fixtureBytes, layerNamed, recordsOf } from '#core-tests/helpers/fig/patch'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'
import { expectDefined } from '@open-pencil/test-support/assert'

import { hasPendingReaderPages } from '#core/kiwi/fig/session/document-state'

setDefaultTimeout(60_000)

test('independent headless branches preserve distinct new GUIDs across patched saves', async () => {
  const bytes = await fixtureBytes()
  const first = await open(bytes)
  const second = await open(bytes)
  // Imported handles remain usable by headless scripts; only newly authored identities differ.
  expect(layerNamed(first, 'A').id).toBe(layerNamed(second, 'A').id)
  const left = first.createNode('RECTANGLE', first.getPages()[0].id, { name: 'Left branch' })
  const right = second.createNode('RECTANGLE', second.getPages()[0].id, { name: 'Right branch' })
  expect(left.id).not.toBe(right.id)
  const savedLeft = await exportFigFile(first)
  const savedRight = await exportFigFile(second)
  const leftRecord = parseFigBuffer(Uint8Array.from(savedLeft).buffer).nodeChanges.find(
    (record) => record.name === left.name
  )
  const rightRecord = parseFigBuffer(Uint8Array.from(savedRight).buffer).nodeChanges.find(
    (record) => record.name === right.name
  )
  expect(guidToString(expectDefined(leftRecord?.guid))).toBe(left.id)
  expect(guidToString(expectDefined(rightRecord?.guid))).toBe(right.id)
  const reopened = await open(savedLeft)
  expect(layerNamed(reopened, left.name).source.id).toBe(left.id)
  // Saving wrote into the archive: the pages not opened stay unpopulated, and every record the
  // file held, theirs included, is saved under its GUID.
  expect(hasPendingReaderPages(first)).toBe(true)
  const saved = recordsOf(savedLeft)
  expect([...recordsOf(bytes).keys()].filter((guid) => !saved.has(guid))).toEqual([])
})

test('styles added to an opened file are written on the internal canvas, not as layers', async () => {
  const bytes = await fixtureBytes()
  const graph = await open(bytes)
  const page = graph.getPages()[0]
  const style = graph.createNode('RECTANGLE', page.id, {
    name: 'Brand',
    sharedStyleType: 'FILL',
    internalOnly: true
  })
  style.source.id = 'style:a1b2c3d4e5f6'
  graph.updateNode(layerNamed(graph, 'A').id, { fillStyleId: style.source.id })

  const saved = await exportFigFile(graph)
  const records = [...recordsOf(saved).values()]
  const internal = records.find((record) => record.type === 'CANVAS' && record.internalOnly)
  const definition = records.find((record) => record.name === 'Brand')
  expect(definition?.parentIndex?.guid).toEqual(expectDefined(internal?.guid))
  // A style made in OpenPencil is saved under its own ID, as a new layer is.
  expect(guidToString(expectDefined(definition?.guid))).toBe(style.id)
  // The page's layers keep their records: the style takes no place among them.
  const before = recordsOf(bytes)
  for (const name of ['Frame', 'Dot']) {
    const record = records.find((candidate) => candidate.name === name)
    expect(record).toEqual(before.get(guidToString(expectDefined(record?.guid))))
  }
  const reopened = await open(saved)
  const styled = layerNamed(reopened, 'A')
  expect(getSharedStyles(reopened, 'fill').find((s) => s.id === styled.fillStyleId)?.name).toBe(
    'Brand'
  )
})
