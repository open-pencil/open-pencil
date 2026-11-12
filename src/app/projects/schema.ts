import * as v from 'valibot'

/**
 * A project is what a repository is opened as: the repository root, the application inside it
 * that can be started, and the command that starts it. Source control, the app runner, and the
 * screen walk all hang off this record instead of off the application as a whole.
 */
export const projectSchema = v.object({
  /** Stable identifier the home list and the workspace refer to. */
  id: v.pipe(v.string(), v.minLength(1)),
  /** What the home list shows; defaults to the repository folder's name. */
  name: v.pipe(v.string(), v.minLength(1)),
  /** Absolute path of the repository root, with forward slashes. */
  repository: v.pipe(v.string(), v.minLength(1)),
  /** The application inside the repository, relative to its root; empty for a single-app repo. */
  appDirectory: v.string(),
  /** The command that starts the application; empty until the project is prepared. */
  startCommand: v.string(),
  /** The address the start command serves, when it is known. */
  startUrl: v.string()
})
export type Project = v.InferOutput<typeof projectSchema>

/** What the caller knows when a project is created; the rest is derived. */
export type ProjectDraft = {
  repository: string
  appDirectory?: string
  startCommand?: string
  startUrl?: string
  name?: string
}

/**
 * A path keeps forward slashes and no trailing separator, so two spellings of the same folder
 * compare equal and the stored record never depends on the platform that wrote it.
 */
export function normalizePath(path: string): string {
  const forward = path.trim().replaceAll('\\', '/')
  const withoutTrailing = forward.replace(/\/+$/, '')
  return withoutTrailing === '' ? '/' : withoutTrailing
}

/** The last segment of a path, used as the name a project gets until it is renamed. */
export function folderName(path: string): string {
  const normal = normalizePath(path)
  const segments = normal.split('/').filter((segment) => segment !== '')
  return segments.at(-1) ?? normal
}

/**
 * A project id is derived from the repository path, so the same repository added twice answers
 * the same record instead of a duplicate: two project entries for one repository would each
 * carry their own branch and changes.
 *
 * The path is folded to one case first: Windows hands back either spelling for one folder, and a
 * project would appear twice. On a case-sensitive file system two folders that differ only by
 * case therefore share an id, which is the price of one repository staying one project.
 */
export function projectIdFor(repository: string): string {
  return `project-${digestOf(normalizePath(repository).toLowerCase())}`
}

/**
 * FNV-1a over the folded path, 64 bits wide. A 32-bit digest meets another path after a few
 * thousand projects, and the list keeps one record per id, so a collision would replace one
 * project with another one from a different folder.
 */
function digestOf(text: string): string {
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash ^ BigInt(text.charCodeAt(index))) * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return hash.toString(36)
}

/** Build the record a caller can persist, rejecting a draft without a repository. */
export function createProject(draft: ProjectDraft): Project | null {
  const repository = normalizePath(draft.repository)
  if (repository === '' || repository === '/') return null
  const appDirectory = draft.appDirectory === undefined ? '' : normalizePath(draft.appDirectory)
  return {
    id: projectIdFor(repository),
    name: draft.name?.trim() || folderName(repository),
    repository,
    // A leading separator would read as an absolute path and escape the repository.
    appDirectory: appDirectory.replace(/^\/+/, ''),
    startCommand: draft.startCommand?.trim() ?? '',
    startUrl: draft.startUrl?.trim() ?? ''
  }
}
