import type { ProjectDetection } from './detect'
import type { Project } from './schema'

/** What adding a project asks of the outside: the folder picker and the detector. */
export type ProjectImportIo = {
  /** The folder the person picked, or null when they cancelled the dialog. */
  chooseFolder: (title: string) => Promise<string | null>
  detect: (folder: string) => Promise<ProjectDetection>
}

/** What adding a project did; every outcome but `added` leaves the list as it was. */
export type ProjectImportOutcome =
  | { kind: 'cancelled' }
  | { kind: 'added'; project: Project }
  | { kind: 'notRepository' }
  | { kind: 'unavailable' }
  | { kind: 'failed'; reason: string }

/**
 * Ask for a folder, detect the project inside it, and report what happened. Nothing is stored
 * here: the caller owns the list, so the same flow serves the home screen and any later caller.
 */
export async function importProject(
  io: ProjectImportIo,
  title: string
): Promise<ProjectImportOutcome> {
  try {
    const folder = await io.chooseFolder(title)
    if (folder === null) return { kind: 'cancelled' }
    const detection = await io.detect(folder)
    if (detection.kind === 'detected') return { kind: 'added', project: detection.project }
    return detection.kind === 'not-repository' ? { kind: 'notRepository' } : { kind: 'unavailable' }
  } catch (error) {
    return { kind: 'failed', reason: error instanceof Error ? error.message : String(error) }
  }
}
