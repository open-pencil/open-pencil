import type { DriftDocument } from '../use'
import { desktopSidecarFiles, type SidecarFiles } from './files'
import { mergeBaselines, parseSidecar, sidecarOf, sidecarText } from './model'

/**
 * Where a project keeps the baselines of one document: the repository it sits in, the baselines
 * the open document holds, and the document's own name, which tells two documents apart.
 */
export type BaselineProject = {
  repository: string
  document: DriftDocument
  /** The document's file name, or null while it has never been saved. */
  name: string | null
  /** The project's files; the desktop's own by default. */
  files?: SidecarFiles
}

/** What writing the baselines to a project did. */
export type SidecarWrite =
  | { status: 'written'; frames: number }
  | { status: 'empty' }
  | { status: 'other-document' }
  | { status: 'unavailable' }

/** What reading them back did. */
export type SidecarRead =
  | { status: 'restored'; frames: number }
  | { status: 'unchanged' }
  | { status: 'missing' }
  | { status: 'other-document' }
  | { status: 'unavailable' }

/** What happened last, which the panel says in its own words. */
export type SidecarOutcome = SidecarWrite | SidecarRead

/**
 * Write the document's baselines into its project, so they outlive the document's own format and
 * travel with a commit. A document with no picture yet writes nothing: an empty sidecar would
 * erase the pictures a project already holds. What the project already holds is read first and
 * kept, so a teammate's baselines survive the write; a sidecar that belongs to another document
 * is refused rather than replaced, because it is the only copy of that document's pictures.
 */
export async function writeBaselines(project: BaselineProject): Promise<SidecarWrite> {
  const file = project.document.read()
  const frames = Object.keys(file.references).length
  if (frames === 0) return { status: 'empty' }
  const files = project.files ?? desktopSidecarFiles()
  const held = await files.read(project.repository)
  if (held === null) {
    const written = await files.write(
      project.repository,
      sidecarText(sidecarOf(file, project.name))
    )
    return written ? { status: 'written', frames } : { status: 'unavailable' }
  }
  const sidecar = parseSidecar(held)
  if (
    sidecar.document !== undefined &&
    project.name !== null &&
    sidecar.document !== project.name
  ) {
    return { status: 'other-document' }
  }
  const merged = mergeBaselines(file, sidecar)
  const written = await files.write(
    project.repository,
    sidecarText(sidecarOf(merged, project.name))
  )
  if (!written) return { status: 'unavailable' }
  return { status: 'written', frames: Object.keys(merged.references).length }
}

/**
 * Fold the pictures a project holds into the open document, as one undoable edit. A sidecar written
 * by another document is left alone rather than read into this one, and a document that already
 * holds the pictures is not edited at all, so reading twice does not fill the history.
 */
export async function readBaselines(project: BaselineProject): Promise<SidecarRead> {
  const files = project.files ?? desktopSidecarFiles()
  const text = await files.read(project.repository)
  if (text === null) return { status: 'missing' }
  const sidecar = parseSidecar(text)
  if (
    sidecar.document !== undefined &&
    project.name !== null &&
    sidecar.document !== project.name
  ) {
    return { status: 'other-document' }
  }
  const current = project.document.read()
  const merged = mergeBaselines(current, sidecar)
  const frames = Object.entries(merged.references).filter(([nodeId, reference]) => {
    const kept = current.references[nodeId]
    return (
      !Object.hasOwn(current.references, nodeId) ||
      kept.digest !== reference.digest ||
      kept.capturedAt !== reference.capturedAt
    )
  }).length
  if (frames === 0) return { status: 'unchanged' }
  project.document.write(merged)
  return { status: 'restored', frames }
}
