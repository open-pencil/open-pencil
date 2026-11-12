import * as v from 'valibot'

import { createProject, normalizePath, type Project } from './schema'

/** What detecting a project asks of the outside; injected so the rules are testable alone. */
export type ProjectDetectorIo = {
  /** The repository root that holds a folder, as git answers it, or why there is none. */
  repositoryRoot: (folder: string) => Promise<RepositoryRootAnswer>
  /** Read a UTF-8 file, or answer null when it does not exist. */
  readText: (path: string) => Promise<string | null>
}

/** A picked folder is inside a repository, outside every repository, or git cannot be asked. */
export type RepositoryRootAnswer =
  | { kind: 'repository'; root: string }
  | { kind: 'not-repository' }
  | { kind: 'unavailable' }

/** What a picked folder turned out to be: the project, or the reason it is not one. */
export type ProjectDetection =
  | { kind: 'detected'; project: Project }
  | { kind: 'not-repository' }
  | { kind: 'unavailable' }

/** The application inside a repository: where it lives, what starts it, and where it answers. */
type Application = {
  /** The folder the application lives in, relative to the repository; empty at the root. */
  directory: string
  startCommand: string
  startUrl: string
}

const packageManifestSchema = v.object({
  name: v.optional(v.string()),
  scripts: v.optional(v.record(v.string(), v.string()))
})
type PackageManifest = v.InferOutput<typeof packageManifestSchema>

/**
 * A port a start command names, in the forms dev servers are started with: `--port 3000`,
 * `--port=3000`, the short `-p 3000`, and a `PORT=3000` in front of the command.
 */
const PORT_FLAG = /(?:--port[= ]|-p[= ]|PORT=)(\d{2,5})(?!\d)/

/**
 * Turn a chosen folder into a project: the repository root comes from git, so opening a
 * subfolder of a repository still yields the repository, and the start command comes from the
 * package manifest that has one — the root's, or the picked folder's in a monorepo whose root
 * holds no scripts.
 */
export async function detectProject(
  io: ProjectDetectorIo,
  folder: string
): Promise<ProjectDetection> {
  const answer = await io.repositoryRoot(folder)
  if (answer.kind !== 'repository') return { kind: answer.kind }
  const repository = normalizePath(answer.root)
  if (repository === '' || repository === '/') return { kind: 'not-repository' }

  const manifest = await readManifest(io, repository)
  const application =
    applicationOf(manifest, '') ?? (await applicationInPickedFolder(io, repository, folder))

  const project = createProject({
    repository,
    appDirectory: application?.directory ?? '',
    ...(manifest?.name === undefined ? {} : { name: manifest.name }),
    startCommand: application?.startCommand ?? '',
    startUrl: application?.startUrl ?? ''
  })
  return project === null ? { kind: 'not-repository' } : { kind: 'detected', project }
}

/** The application the picked folder holds, when it is not the repository root itself. */
async function applicationInPickedFolder(
  io: ProjectDetectorIo,
  repository: string,
  folder: string
): Promise<Application | null> {
  const picked = normalizePath(folder)
  const directory = directoryIn(repository, picked, foldsPathCase())
  if (directory === null) return null
  const manifest = await readManifest(io, picked)
  return applicationOf(manifest, directory)
}

/**
 * Where the picked folder sits inside the repository: `code/web` for `D:/app/code/web`, and null
 * for the repository root itself or a folder outside it. The folder that comes back keeps the
 * spelling the person picked, since git answers the root in its own.
 */
export function directoryIn(repository: string, picked: string, foldsCase: boolean): string | null {
  // One more character than the root is the shortest folder that can sit inside it.
  if (picked.length <= repository.length + 1) return null
  if (picked[repository.length] !== '/') return null
  const prefix = picked.slice(0, repository.length)
  const same = foldsCase ? prefix.toLowerCase() === repository.toLowerCase() : prefix === repository
  return same ? picked.slice(repository.length + 1) : null
}

/**
 * Whether this platform names one folder in either case. Windows answers `d:/karbid2` for the root
 * it calls `D:/Karbid2`, so a prefix compared exactly would leave the picked application out; on a
 * file system that keeps case, two spellings are two folders and only an exact prefix counts.
 */
function foldsPathCase(): boolean {
  if (typeof navigator === 'undefined') return false
  return /win|mac|darwin/i.test(navigator.platform)
}

/** A manifest makes an application when it has a script that starts one. */
function applicationOf(manifest: PackageManifest | null, directory: string): Application | null {
  if (manifest === null) return null
  const startCommand = startCommandOf(manifest)
  if (startCommand === '') return null
  return { directory, startCommand, startUrl: startURLOf(startCommand) }
}

async function readManifest(
  io: ProjectDetectorIo,
  folder: string
): Promise<PackageManifest | null> {
  const text = await io.readText(`${folder}/package.json`)
  if (text === null) return null
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), packageManifestSchema), text)
  return parsed.success ? parsed.output : null
}

/** `dev` starts an application people work on; `start` is the fallback some packages use. */
function startCommandOf(manifest: PackageManifest): string {
  const scripts = manifest.scripts ?? {}
  return (scripts.dev || scripts.start || '').trim()
}

/** A command that names its port already tells us where the application will answer. */
function startURLOf(startCommand: string): string {
  const port = PORT_FLAG.exec(startCommand)?.[1]
  return port === undefined ? '' : `http://127.0.0.1:${port}`
}
