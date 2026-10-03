import assert from 'node:assert/strict'

import * as v from 'valibot'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { parseFigBuffer } from '@open-pencil/fig'
import { getCompiledSchema, initCodec } from '@open-pencil/kiwi/fig/codec'
import { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'
import { createSessionIdGenerator, serializeGraphSnapshot } from '@open-pencil/scene-graph'

import { fixture, fork } from './fixture'
import { projectPersistedGraph, semanticChanges } from './merge'

export function randomGuidId(): string {
  const words = crypto.getRandomValues(new Uint32Array(2))
  return `${words[0]}:${words[1]}`
}

function collisionProbability(bits: number, count: number): number {
  return -Math.expm1(-(count * (count - 1)) / (2 * 2 ** bits))
}

export async function probeIdentity(output: string) {
  const { graph, page, card } = fixture()
  const add = (session: number) =>
    fork(graph, createSessionIdGenerator(session)).createNode('RECTANGLE', page.id).id
  const forcedCollision = [add(99), add(99)]
  assert.equal(forcedCollision[0], forcedCollision[1])

  const count = 100_000
  const randomIds = new Set(Array.from({ length: count }, randomGuidId))
  assert.equal(randomIds.size, count)
  const legacyIds = [...graph.nodes.keys()]
  const migrated = fork(graph, randomGuidId)
  assert.deepEqual([...migrated.nodes.keys()], legacyIds)
  const newNode = migrated.createNode('RECTANGLE', page.id)
  assert.ok(!legacyIds.includes(newNode.id))
  assert.equal(serializeGraphSnapshot(fork(graph)), serializeGraphSnapshot(graph))

  await initCodec()
  const codec = getCompiledSchema()
  const candidates = [createSessionIdGenerator(99)(), randomGuidId(), crypto.randomUUID()]
  const wireSchema = v.object({
    nodeChanges: v.array(
      v.object({
        guid: v.object({
          sessionID: v.number(),
          localID: v.number()
        })
      })
    )
  })
  const codecResults = candidates.map((id) => {
    const guid = stringToGuid(id)
    const numericGuid = Number.isInteger(guid.sessionID) && Number.isInteger(guid.localID)
    if (!numericGuid)
      return { id, roundtrip: false, reason: 'Requires an explicit UUID-to-GUID mapping' }
    const encoded = codec.encodeMessage({ type: 'NODE_CHANGES', nodeChanges: [{ guid }] })
    const decoded = v.parse(wireSchema, codec.decodeMessage(encoded))
    const roundtrip = guidToString(decoded.nodeChanges[0].guid) === id
    assert.ok(roundtrip)
    return { id, roundtrip, reason: 'Exact bundled Kiwi codec round trip' }
  })

  const saved = await exportFigFile(graph)
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 20)
  })
  const savedAgain = await exportFigFile(graph)
  const firstArchive = parseFigBuffer(Uint8Array.from(saved).buffer)
  const secondArchive = parseFigBuffer(Uint8Array.from(savedAgain).buffer)
  assert.notDeepEqual(saved, savedAgain)
  assert.notEqual(firstArchive.metaJSON, secondArchive.metaJSON)
  const reopened = await parseFigFile(Uint8Array.from(saved).buffer)
  const reopenedCard = [...reopened.nodes.values()].find((node) => node.name === card.name)
  assert.ok(reopenedCard)
  assert.notEqual(reopenedCard.id, card.id)
  const exportedCard = firstArchive.nodeChanges.find((node) => node.name === card.name)
  assert.ok(exportedCard?.guid)
  const savedGuid = guidToString(exportedCard.guid)
  assert.equal(reopenedCard.source.id, savedGuid)

  const inserted = fork(graph)
  const extra = inserted.createNode('RECTANGLE', page.id, { name: 'Inserted first' })
  inserted.reorderChild(extra.id, page.id, 0)
  const insertionBytes = await exportFigFile(inserted)
  const insertionArchive = parseFigBuffer(Uint8Array.from(insertionBytes).buffer)
  const shiftedExport = insertionArchive.nodeChanges.find((node) => node.name === card.name)
  assert.ok(shiftedExport?.guid)
  const afterInsertionGuid = guidToString(shiftedExport.guid)
  assert.notEqual(afterInsertionGuid, savedGuid)
  const withInsertion = await parseFigFile(Uint8Array.from(insertionBytes).buffer)
  const shiftedCard = [...withInsertion.nodes.values()].find((node) => node.name === card.name)
  assert.ok(shiftedCard)
  assert.notEqual(shiftedCard.id, reopenedCard.id)

  // Probe the persistence requirement through the existing exporter, without changing it.
  // This is not a production migration: source.id also selects imported-source policies.
  const pinned = fork(graph)
  for (const node of pinned.nodes.values()) {
    if (!node.source.id) node.source.id = node.id
  }
  const pinnedBytes = await exportFigFile(pinned)
  const pinnedRoundtrip = await parseFigFile(Uint8Array.from(pinnedBytes).buffer)
  const pinnedCard = [...pinnedRoundtrip.nodes.values()].find((node) => node.source.id === card.id)
  assert.ok(pinnedCard)
  const pinnedExtra = pinned.createNode('RECTANGLE', page.id, { name: 'Pinned insertion' })
  pinnedExtra.source.id = pinnedExtra.id
  pinned.reorderChild(pinnedExtra.id, page.id, 0)
  const pinnedInsertionBytes = await exportFigFile(pinned)
  const pinnedInsertion = await parseFigFile(Uint8Array.from(pinnedInsertionBytes).buffer)
  const pinnedCardAfterInsertion = [...pinnedInsertion.nodes.values()].find(
    (node) => node.source.id === card.id
  )
  assert.ok(pinnedCardAfterInsertion)
  assert.ok([...pinnedInsertion.nodes.values()].some((node) => node.source.id === pinnedExtra.id))
  assert.notEqual(pinnedCard.id, pinnedCardAfterInsertion.id)
  const persistedReviewChanges = semanticChanges(
    projectPersistedGraph(pinnedRoundtrip),
    projectPersistedGraph(pinnedInsertion)
  )
  assert.equal(persistedReviewChanges.length, 2)
  assert.ok(persistedReviewChanges.every((change) => !change.includes('(Card)')))
  await Bun.write(`${output}/original.fig`, saved)
  await Bun.write(`${output}/insertion.fig`, insertionBytes)
  await Bun.write(`${output}/pinned.fig`, pinnedBytes)
  await Bun.write(`${output}/pinned-insertion.fig`, pinnedInsertionBytes)
  await Bun.write(`${output}/persisted-review.md`, `${persistedReviewChanges.join('\n')}\n`)

  return {
    forcedSessionCollision: forcedCollision,
    randomGuidSample: { count, unique: randomIds.size },
    theoreticalCollisionRisk: [10_000, 1_000_000].map((allocations) => ({
      allocations,
      session32: collisionProbability(32, allocations),
      guid64: collisionProbability(64, allocations),
      uuid122: collisionProbability(122, allocations)
    })),
    codecResults,
    migration: {
      existingIdsRetained: legacyIds.length,
      newId: newNode.id,
      snapshotReloadEqual: true
    },
    fig: {
      repeatedBytesEqual: false,
      metadataEqual: false,
      originalId: card.id,
      savedGuid,
      reopenedId: reopenedCard.id,
      afterInsertionGuid,
      afterInsertionRuntimeId: shiftedCard.id,
      pinnedCardId: pinnedCard.source.id,
      pinnedCardAfterInsertion: pinnedCardAfterInsertion.source.id,
      pinnedRuntimeId: pinnedCard.id,
      pinnedRuntimeIdAfterInsertion: pinnedCardAfterInsertion.id,
      persistedReviewChanges,
      rootBefore: graph.rootId,
      rootAfter: pinnedRoundtrip.rootId,
      originalRuntimeIdsStillIntact: graph.getNode(card.id)?.id === card.id
    }
  }
}
