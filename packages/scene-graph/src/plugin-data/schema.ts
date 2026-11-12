import * as v from 'valibot'

/**
 * The shapes of the plugin data OpenPencil writes, kept apart from the registry that names it so a
 * reader can share a schema with the writer without going through the registry.
 */

/** The one kind of address a page is: the application's own, over HTTP. */
const PAGE_ADDRESS = /^https?:\/\//i

/**
 * A page of the application a frame shows: the address its dev server answers on. The scheme is
 * part of the shape rather than a rule the panel keeps, so a document that names another one —
 * `javascript:` in a file from somewhere else — is a frame that draws its own layers.
 */
export const livePageSchema = v.object({
  url: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(2048), v.regex(PAGE_ADDRESS)),
  label: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120))),
  mode: v.picklist(['live', 'snapshot'])
})

/** Where a page stood when its picture was taken: what the frame shows, and when. */
export const driftReferenceSchema = v.object({
  nodeId: v.pipe(v.string(), v.minLength(1)),
  url: v.pipe(v.string(), v.minLength(1)),
  capturedAt: v.pipe(v.string(), v.minLength(1)),
  width: v.pipe(v.number(), v.integer(), v.minValue(1)),
  height: v.pipe(v.number(), v.integer(), v.minValue(1)),
  /** SHA-256 of the picture's bytes, which is all a comparison needs to say it changed. */
  digest: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))
})

/** The page baselines a document carries, keyed by the frame each belongs to. */
export const driftSchema = v.object({
  version: v.literal(1),
  references: v.record(v.string(), driftReferenceSchema)
})
