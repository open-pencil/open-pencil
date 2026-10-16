import { expect, test } from 'bun:test'

import {
  invalidateLoadedRevision,
  matchesLoadedRevision,
  rememberLoadedRevision
} from '@/app/document/io/revision'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

test('revision pins exact input bytes and cannot be invented for a new document', async () => {
  const graph = makeSceneGraph()
  expect(await matchesLoadedRevision(graph, SHA256_ABC)).toBe(false)
  rememberLoadedRevision(graph, new File(['abc'], 'library.fig'))
  expect(await matchesLoadedRevision(graph, SHA256_ABC)).toBe(true)
  expect(await matchesLoadedRevision(graph, '0'.repeat(64))).toBe(false)
})

test('authored content and explicit save invalidation reject a cached source hash', async () => {
  const graph = makeSceneGraph()
  rememberLoadedRevision(graph, new File(['abc'], 'library.fig'))
  graph.createNode('COMPONENT', firstPageId(graph), { name: 'Changed' })
  expect(await matchesLoadedRevision(graph, SHA256_ABC)).toBe(false)
  rememberLoadedRevision(graph, new File(['abc'], 'library.fig'))
  invalidateLoadedRevision(graph)
  expect(await matchesLoadedRevision(graph, SHA256_ABC)).toBe(false)
})

test('an edit while the input hash is pending rejects the original revision', async () => {
  const graph = makeSceneGraph()
  rememberLoadedRevision(graph, new File(['abc'], 'library.fig'))
  const pending = matchesLoadedRevision(graph, SHA256_ABC)
  graph.createNode('COMPONENT', firstPageId(graph), { name: 'Changed' })
  expect(await pending).toBe(false)
})

test('replacing the loaded file while hashing rejects the earlier input', async () => {
  const graph = makeSceneGraph()
  rememberLoadedRevision(graph, new File(['abc'], 'library.fig'))
  const pending = matchesLoadedRevision(graph, SHA256_ABC)
  rememberLoadedRevision(graph, new File(['changed'], 'library.fig'))
  expect(await pending).toBe(false)
})
