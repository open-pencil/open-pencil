import * as v from 'valibot'

import { parseReferences, type DriftFile, type DriftReference } from '../schema'

/**
 * The folder a project keeps this app's own files in. It sits inside the repository, so what it
 * holds travels with the code and reaches the next person who opens the project.
 */
export const DRIFT_SIDECAR_FOLDER = '.opencanvas'

/** The file inside that folder that holds the baselines of the project's document. */
export const DRIFT_SIDECAR_FILE = 'drift.json'

/** The sidecar's path from the repository root, which is also the pathspec git is given. */
export const DRIFT_SIDECAR_PATH = `${DRIFT_SIDECAR_FOLDER}/${DRIFT_SIDECAR_FILE}`

/**
 * The baselines a project holds for one document. A base layout keeps its baselines in the
 * document's plugin data, which a `.fig` or `.pen` written over it does not carry; the sidecar is
 * the copy that survives that, and the one a commit shares.
 */
export type DriftSidecar = {
  version: 1
  /** The document the pictures were taken from, since a repository can hold more than one. */
  document?: string
  references: Record<string, DriftReference>
}

/** A sidecar as text, before anything in it is trusted: a picture is read one entry at a time. */
const sidecarTextSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ document: v.optional(v.unknown()), references: v.optional(v.unknown()) })
)

/** A sidecar holding nothing, which is what a project without one reads as. */
export function emptySidecar(): DriftSidecar {
  return { version: 1, references: {} }
}

/**
 * The sidecar a document's baselines belong in. The document's own name is kept beside them, so a
 * project holding two documents tells their pictures apart instead of mixing them.
 */
export function sidecarOf(file: DriftFile, document: string | null): DriftSidecar {
  return document === null
    ? { version: 1, references: file.references }
    : { version: 1, document, references: file.references }
}

/** The code unit order of two frame ids, which is the same in every language. */
function byCodeUnit(left: string, right: string): number {
  if (left < right) return -1
  return left > right ? 1 : 0
}

/**
 * A sidecar as it is written. Frames are ordered by their ids rather than by when they were
 * pictures, so two commits of the same baselines differ only where a baseline did. The order is
 * the code unit order, which is the same on every machine: a collator that follows the runtime's
 * language would order the same ids differently, and the file would churn between them.
 */
export function sidecarText(sidecar: DriftSidecar): string {
  const references = Object.fromEntries(
    Object.entries(sidecar.references).sort(([left], [right]) => byCodeUnit(left, right))
  )
  const ordered: DriftSidecar =
    sidecar.document === undefined
      ? { version: 1, references }
      : { version: 1, document: sidecar.document, references }
  return `${JSON.stringify(ordered, null, 2)}\n`
}

/**
 * The baselines a project's sidecar holds. A file anyone can edit is read entry by entry: a
 * picture written by an older version is dropped rather than throwing the whole set away.
 */
export function parseSidecar(text: string): DriftSidecar {
  const parsed = v.safeParse(sidecarTextSchema, text)
  if (!parsed.success) {
    console.warn('[Drift] The project sidecar is not a baseline file:', parsed.issues[0].message)
    return emptySidecar()
  }
  const document = parsed.output.document
  return {
    version: 1,
    document: typeof document === 'string' && document !== '' ? document : undefined,
    references: parseReferences(parsed.output.references)
  }
}

/**
 * The baselines of a document with the ones its project holds folded in. A picture taken later
 * describes the page as it stands now, so it wins over an earlier one of the same frame; a frame
 * the document has never compared takes the project's picture as it is.
 */
export function mergeBaselines(document: DriftFile, sidecar: DriftSidecar): DriftFile {
  const references: Record<string, DriftReference> = { ...document.references }
  for (const [nodeId, reference] of Object.entries(sidecar.references)) {
    const kept = document.references[nodeId]
    if (!Object.hasOwn(document.references, nodeId) || kept.capturedAt < reference.capturedAt) {
      references[nodeId] = reference
    }
  }
  return { version: 1, references }
}
