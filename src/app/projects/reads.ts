/**
 * A missing file and a file this app may not read both arrive as a failed read, and the detector
 * needs to tell them apart: the first means "this project has no manifest", the second means the
 * person should hear why the manifest was not used.
 */

/**
 * The codes the system reports a missing path with — `ENOENT`, and the code Windows uses when a
 * folder on the way is gone. The words around them are localised, so only the code is matched.
 */
const MISSING_PATH = /\(os error (?:2|3)\)/

/** Whether a failed read means the file is not there, rather than one this app may not make. */
export function isMissingFile(error: unknown): boolean {
  return MISSING_PATH.test(error instanceof Error ? error.message : String(error))
}

/** The error a read the app could not make is reported as, naming the file and what it said. */
export function readFailure(path: string, error: unknown): Error {
  return new Error(
    `Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`
  )
}

/**
 * Read text through `read`, answering null only when the file is not there. Every other failure is
 * thrown so a caller can report it: a scope denial read as a missing manifest quietly makes a
 * project with no start command and no reason why.
 */
export async function readTextOrMissing(
  path: string,
  read: (path: string) => Promise<Uint8Array>
): Promise<string | null> {
  try {
    return new TextDecoder().decode(await read(path))
  } catch (error) {
    if (isMissingFile(error)) return null
    throw readFailure(path, error)
  }
}
