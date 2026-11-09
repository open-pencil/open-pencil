import * as v from 'valibot'

/** Where a page stood when its picture was taken: what the frame shows, and when. */
export const driftReferenceSchema = v.object({
  nodeId: v.pipe(v.string(), v.minLength(1)),
  url: v.pipe(v.string(), v.minLength(1)),
  /** When the picture was taken, so a person can tell an old baseline from a new one. */
  capturedAt: v.pipe(v.string(), v.minLength(1)),
  width: v.pipe(v.number(), v.integer(), v.minValue(1)),
  height: v.pipe(v.number(), v.integer(), v.minValue(1)),
  /** SHA-256 of the picture's bytes, which is all a comparison needs to say it changed. */
  digest: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))
})
export type DriftReference = v.InferOutput<typeof driftReferenceSchema>

/** Every baseline the document keeps, keyed by the frame it belongs to. */
export const driftFileSchema = v.object({
  version: v.literal(1),
  references: v.record(v.string(), driftReferenceSchema)
})
export type DriftFile = v.InferOutput<typeof driftFileSchema>

/** An empty baseline, written when a document has not been compared yet. */
export function emptyDriftFile(): DriftFile {
  return { version: 1, references: {} }
}

/**
 * The baselines a document's sidecar holds. A file anyone can edit may be malformed or written by
 * an older version: a bad baseline is dropped rather than thrown on, and the rest is kept.
 */
export function parseDriftFile(text: string): DriftFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    console.warn('[Drift] The baseline file is not JSON:', error)
    return emptyDriftFile()
  }
  const file = v.safeParse(driftFileSchema, parsed)
  if (file.success) return file.output
  const references: Record<string, DriftReference> = {}
  const candidate = (parsed as { references?: unknown }).references
  if (typeof candidate === 'object' && candidate !== null) {
    for (const [nodeId, value] of Object.entries(candidate)) {
      const reference = v.safeParse(driftReferenceSchema, value)
      if (reference.success) references[nodeId] = reference.output
    }
  }
  return { version: 1, references }
}

/** The file as it is written back, with one frame's baseline replaced. */
export function withReference(file: DriftFile, reference: DriftReference): DriftFile {
  return { version: 1, references: { ...file.references, [reference.nodeId]: reference } }
}
