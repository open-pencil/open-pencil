import * as v from 'valibot'

import { driftReferenceSchema, type driftSchema } from '@open-pencil/scene-graph/plugin-data'

export type DriftReference = v.InferOutput<typeof driftReferenceSchema>
export type DriftFile = v.InferOutput<typeof driftSchema>

/** An empty baseline, written when a document has not been compared yet. */
export function emptyDriftFile(): DriftFile {
  return { version: 1, references: {} }
}

/** A baseline file as text, before anything in it is trusted. */
const driftTextSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ references: v.optional(v.unknown()) })
)

/**
 * The baselines a value holds, read one at a time. A file anyone can edit may be written by an
 * older version: a bad baseline is dropped rather than thrown on, and the rest is kept.
 */
export function parseReferences(value: unknown): Record<string, DriftReference> {
  const references: Record<string, DriftReference> = {}
  if (typeof value !== 'object' || value === null) return references
  for (const [nodeId, entry] of Object.entries(value)) {
    const reference = v.safeParse(driftReferenceSchema, entry)
    if (reference.success) references[nodeId] = reference.output
  }
  return references
}

/** The baselines a document's file holds, read reference by reference. */
export function parseDriftFile(text: string): DriftFile {
  const parsed = v.safeParse(driftTextSchema, text)
  if (!parsed.success) {
    console.warn('[Drift] The baseline file is not a baseline document:', parsed.issues[0].message)
    return emptyDriftFile()
  }
  return { version: 1, references: parseReferences(parsed.output.references) }
}

/** The file as it is written back, with one frame's baseline replaced. */
export function withReference(file: DriftFile, reference: DriftReference): DriftFile {
  return { version: 1, references: { ...file.references, [reference.nodeId]: reference } }
}
