import * as v from 'valibot'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

/** The Kiwi codec validates a node change; a fixture only checks that the record is an object. */
export const figNodeChangeFixtureSchema = v.custom<NodeChange>(
  (value) => typeof value === 'object' && value !== null
)

/** A `{ nodeChanges, blobs }` capture recorded from a live Figma document. */
export const capturedFigRecordsSchema = v.object({
  nodeChanges: v.array(figNodeChangeFixtureSchema),
  blobs: v.array(v.string())
})

/** `nested-layout-scale.json`: the same document before and after a nested padding edit. */
export const nestedLayoutScaleFixtureSchema = v.object({
  ids: v.object({
    page: v.string(),
    inner: v.string(),
    outer: v.string(),
    nested: v.string(),
    instance: v.string()
  }),
  before: v.array(figNodeChangeFixtureSchema),
  edited: v.array(figNodeChangeFixtureSchema),
  blobs: v.array(v.string())
})
