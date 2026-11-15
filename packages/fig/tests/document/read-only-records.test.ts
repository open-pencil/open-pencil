import { afterEach, expect, spyOn, test } from 'bun:test'

import { DecodedMap } from '#fig/document/decoded-map'
import { createFigDocumentSession } from '#fig/document/session'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { readFixtureArrayBuffer } from '@open-pencil/test-support/paths'

function deepFreeze(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) return
  if (seen.has(value)) return
  seen.add(value)
  for (const child of Object.values(value)) deepFreeze(child, seen)
  Object.freeze(value)
}

let restore: (() => void) | undefined
afterEach(() => restore?.())

/**
 * Every record the reader keeps for the session, component definitions and styles, is frozen
 * as its interpreter reads it. Those records serve every copy built for the rest of the session,
 * on pages loaded later too, and a copy's payload and the layers built from it share their
 * values rather than copying them, so nothing may write into them.
 */
function freezeServedRecords(): () => number {
  const get = DecodedMap.prototype.get
  let served = 0
  const spy = spyOn(DecodedMap.prototype, 'get').mockImplementation(function (
    this: DecodedMap<unknown, unknown, unknown>,
    key: unknown
  ) {
    const value: unknown = get.call(this, key)
    if (value !== undefined) {
      served++
      deepFreeze(value)
    }
    return value
  })
  restore = () => spy.mockRestore()
  return () => served
}

/** Edits that reach the layers inside instances, as the editor makes them. */
function editInstanceLayers(graph: SceneGraph): void {
  // The first few hundred: syncing all eleven thousand adds seconds and reaches no new code.
  const instances = [...graph.getAllNodes()]
    .filter((node) => node.type === 'INSTANCE')
    .slice(0, 300)
  for (const instance of instances) {
    graph.syncInstance(instance.id)
    const layer: SceneNode | undefined = graph.getChildren(instance.id)[0]
    if (!layer) continue
    graph.updateNode(layer.id, { opacity: 0.5, name: `${layer.name} edited` })
    if (layer.type === 'TEXT') graph.updateNode(layer.id, { text: 'Edited' })
  }
}

test('reading every page of a design kit and editing its instances writes into no kept record', () => {
  const served = freezeServedRecords()
  const session = createFigDocumentSession(readFixtureArrayBuffer('gold-preview.fig'))
  for (const page of session.pages) session.loadPage(page.id)
  editInstanceLayers(session.graph)
  // The kit's component definitions were read through the reader, frozen.
  expect(served()).toBeGreaterThan(100)
})
