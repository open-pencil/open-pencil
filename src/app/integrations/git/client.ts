import { invoke } from '@tauri-apps/api/core'
import * as v from 'valibot'

import { LOG_FORMAT, parseFileHistory, parseFileState } from './file'
import {
  gitAvailabilitySchema,
  gitBranchSchema,
  type GitAvailability,
  type GitBranch,
  type GitCommitSummary,
  type GitFileState,
  type GitRunReport,
  type GitStatus,
  gitRunReportSchema
} from './schema'
import { parseGitStatus } from './status'

/**
 * The native side runs git behind a validated gateway (`desktop/src/git/mod.rs`), so this module
 * only shapes requests and reads results: it never builds a shell string.
 */
export type GitTransport = (command: string, args?: Record<string, unknown>) => Promise<unknown>

/** A failure the panel can render: git's own wording, plus a one-line summary. */
export type GitFailure = {
  ok: false
  code: number
  stderr: string
  summary: string
}

/** Operations answer outcomes rather than throwing, so callers keep their own pending state. */
export type GitOutcome<T> = { ok: true; value: T } | GitFailure

/** The remote the panel pushes to and fetches from unless a repository says otherwise. */
export const DEFAULT_GIT_REMOTE = 'origin'

/** Why a branch the panel was asked for is not one it will name to git. */
const NOT_A_BRANCH_NAME = 'A branch name cannot start with a dash or hold spaces.'

export async function readGitAvailability(
  transport: GitTransport = invoke
): Promise<GitOutcome<GitAvailability>> {
  const raw = await call('git_version', undefined, transport)
  if (!raw.ok) return raw
  const availability = readAnswer(gitAvailabilitySchema, raw.value)
  if (!availability.ok) return availability
  if (!availability.value.available) {
    return failure(0, '', 'git is not installed or not on PATH.')
  }
  return availability
}

/**
 * A browser build and a desktop build without the command both reject the invoke call. The panel
 * reports that as a failure rather than leaving a rejected promise behind.
 */
async function call(
  command: string,
  args: Record<string, unknown> | undefined,
  transport: GitTransport
): Promise<GitOutcome<unknown>> {
  try {
    return { ok: true, value: await transport(command, args) }
  } catch (error) {
    return failure(0, '', refusalOf(error))
  }
}

/**
 * What a refused command said. The gateway refuses with its own sentence — a repository without
 * `.git`, a flag the panel may not send — and Tauri hands that back as a plain string rather than
 * an `Error`, so reading only `Error.message` would replace every reason with "git is unavailable".
 */
function refusalOf(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message
  const said = typeof error === 'string' ? error.trim() : ''
  return said === '' ? 'git is unavailable.' : said
}

/**
 * Read an answer into the shape the app expects. A gateway that answered something else is a
 * failure like any other unwanted answer: validating here would otherwise throw past every caller,
 * and the panel, which only renders outcomes, would never learn what went wrong.
 */
function readAnswer<T>(schema: v.GenericSchema<unknown, T>, answer: unknown): GitOutcome<T> {
  const result = v.safeParse(schema, answer)
  return result.success
    ? { ok: true, value: result.output }
    : failure(0, '', 'git answered something this app does not understand.')
}

/**
 * Run one allow-listed subcommand. A non-zero exit is reported as a failure with git's stderr
 * intact, because that is where hooks and remotes explain what went wrong.
 */
export async function runGit(
  repo: string,
  subcommand: string,
  args: string[] = [],
  transport: GitTransport = invoke
): Promise<GitOutcome<GitRunReport>> {
  const raw = await call('git_run', { repo, subcommand, args }, transport)
  if (!raw.ok) return raw
  const answer = readAnswer(gitRunReportSchema, raw.value)
  if (!answer.ok) return answer
  const report = answer.value
  return report.code === 0 ? { ok: true, value: report } : failure(report.code, report.stderr)
}

/**
 * The repository root that holds a folder, or null when the folder is not inside one. Adding a
 * project starts from a folder the person picked, which need not be the repository root, so the
 * gateway asks git instead of the app walking the path itself.
 */
export async function readRepositoryRoot(
  folder: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<string | null>> {
  const raw = await call('git_repository_root', { folder }, transport)
  if (!raw.ok) return raw
  return { ok: true, value: typeof raw.value === 'string' && raw.value !== '' ? raw.value : null }
}

/** Read the working tree, branch name, upstream, and ahead/behind counts. */
export async function readGitStatus(
  repo: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<GitStatus>> {
  const report = await runGit(repo, 'status', ['--porcelain=v2', '--branch', '-z'], transport)
  if (!report.ok) return report
  return { ok: true, value: parseGitStatus(report.value.stdout) }
}

/**
 * List local branches, newest first is git's own order. A detached HEAD and a rebase are spelled
 * `(HEAD detached at …)` and `(no branch, rebasing …)` in place of a branch name, and neither can
 * be switched to, so they are left out rather than offered.
 */
export async function listGitBranches(
  repo: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<GitBranch[]>> {
  const report = await runGit(repo, 'branch', ['--format=%(HEAD) %(refname:short)'], transport)
  if (!report.ok) return report
  const listed = report.value.stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .map((line) => ({ name: line.slice(2), current: line.startsWith('*') }))
    .filter((branch) => !branch.name.startsWith('('))
  return readAnswer(v.array(gitBranchSchema), listed)
}

/** Stage every change, including deletions, so a panel commit needs one action. */
export async function stageAllChanges(
  repo: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const report = await runGit(repo, 'add', ['-A'], transport)
  return report.ok ? { ok: true, value: null } : report
}

/**
 * Commit what is staged. Hooks run: the gateway denies `--no-verify`, so a repository whose
 * pre-commit rejects the commit answers with the hook's own message.
 */
export async function commitStaged(
  repo: string,
  message: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const trimmed = message.trim()
  if (trimmed === '') return failure(0, '', 'A commit needs a message.')
  const report = await runGit(repo, 'commit', ['-m', trimmed], transport)
  return report.ok ? { ok: true, value: null } : report
}

/** Push the current branch to its upstream, or set one on the first push. */
export async function pushCurrentBranch(
  repo: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const report = await runGit(
    repo,
    'push',
    ['--set-upstream', DEFAULT_GIT_REMOTE, 'HEAD'],
    transport
  )
  return report.ok ? { ok: true, value: null } : report
}

/**
 * Whether the panel can hand git this name as a branch. A name that starts with a dash reads as a
 * flag (`push origin -f` would force the push), and one with whitespace splits into two arguments,
 * so neither is offered to the gateway at all.
 */
function isBranchName(name: string): boolean {
  return !name.startsWith('-') && !/[\s\0]/.test(name)
}

/** Push one named branch and set its upstream, which is what a pull request is opened from. */
export async function pushBranch(
  repo: string,
  branch: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const trimmed = branch.trim()
  if (trimmed === '') return failure(0, '', 'A branch needs a name.')
  if (!isBranchName(trimmed)) return failure(0, '', NOT_A_BRANCH_NAME)
  const report = await runGit(
    repo,
    'push',
    ['--set-upstream', DEFAULT_GIT_REMOTE, trimmed],
    transport
  )
  return report.ok ? { ok: true, value: null } : report
}

/**
 * The address the repository's remote points at. A repository without that remote answers null,
 * which the panel explains instead of offering a pull request it cannot open.
 */
export async function readRemoteURL(
  repo: string,
  remote = DEFAULT_GIT_REMOTE,
  transport: GitTransport = invoke
): Promise<GitOutcome<string | null>> {
  const report = await runGit(repo, 'remote', ['get-url', remote], transport)
  if (!report.ok) return { ok: true, value: null }
  const url = report.value.stdout.trim()
  return { ok: true, value: url === '' ? null : url }
}

/**
 * The branch the repository's remote checks out by default, or null when it does not say. A
 * feature branch pushed with `-u` tracks its own name, so where a pull request lands has to be
 * asked of the remote rather than read off that branch.
 */
export async function readDefaultBranch(
  repo: string,
  remote = DEFAULT_GIT_REMOTE,
  transport: GitTransport = invoke
): Promise<GitOutcome<string | null>> {
  const report = await runGit(repo, 'rev-parse', ['--abbrev-ref', `${remote}/HEAD`], transport)
  if (!report.ok) return { ok: true, value: null }
  const name = report.value.stdout.trim()
  const prefix = `${remote}/`
  // A remote without a recorded HEAD answers with the name it was asked about.
  if (!name.startsWith(prefix) || name === `${remote}/HEAD`) return { ok: true, value: null }
  const branch = name.slice(prefix.length).trim()
  return { ok: true, value: branch === '' ? null : branch }
}

export async function fetchRemote(
  repo: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const report = await runGit(repo, 'fetch', [DEFAULT_GIT_REMOTE, '--prune'], transport)
  return report.ok ? { ok: true, value: null } : report
}

/**
 * Bring the branch up to date with its upstream, refusing to merge when the two diverged: a
 * panel that can only fast-forward never leaves a half-finished merge behind.
 */
export async function pullFastForward(
  repo: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const report = await runGit(repo, 'pull', ['--ff-only'], transport)
  return report.ok ? { ok: true, value: null } : report
}

/** Park every change, untracked files included, so the working tree is clean again. */
export async function stashChanges(
  repo: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const report = await runGit(repo, 'stash', ['push', '--include-untracked'], transport)
  return report.ok ? { ok: true, value: null } : report
}

/**
 * The patch of one file against the last commit, so a change can be read before it is committed.
 * A path git does not track yet has nothing to diff, which the caller tells apart by its kind.
 */
export async function readFileDiff(
  repo: string,
  path: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<string>> {
  const report = await runGit(repo, 'diff', ['HEAD', '--no-color', '--', path], transport)
  return report.ok ? { ok: true, value: report.value.stdout } : report
}

/** Switch to a branch, creating it first when `create` is set. */
export async function switchBranch(
  repo: string,
  name: string,
  create = false,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const trimmed = name.trim()
  if (trimmed === '') return failure(0, '', 'A branch needs a name.')
  if (!isBranchName(trimmed)) return failure(0, '', NOT_A_BRANCH_NAME)
  const report = await runGit(repo, 'switch', create ? ['-c', trimmed] : [trimmed], transport)
  return report.ok ? { ok: true, value: null } : report
}

/** How many versions of a file the history lists; older ones stay in git. */
const HISTORY_LIMIT = 30

/** A commit is named by its hash, which is what `restoreFileFromCommit` will accept. */
const COMMIT_HASH = /^[0-9a-f]{7,40}$/i

/**
 * How one file stands against the last commit. A path the repository ignores answers clean,
 * since there is nothing to commit for it either.
 */
export async function readFileState(
  repo: string,
  path: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<GitFileState>> {
  const report = await runGit(repo, 'status', ['--porcelain=v1', '-z', '--', path], transport)
  return report.ok ? { ok: true, value: parseFileState(report.value.stdout) } : report
}

/** The commits that touched one file, newest first, so its versions can be listed. */
export async function readFileHistory(
  repo: string,
  path: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<GitCommitSummary[]>> {
  const report = await runGit(
    repo,
    'log',
    [`--format=${LOG_FORMAT}`, `--max-count=${HISTORY_LIMIT}`, '--', path],
    transport
  )
  if (report.ok) return { ok: true, value: parseFileHistory(report.value.stdout) }
  // A branch without a first commit has no versions to report, which is not a failure. Git says so
  // in its own language, so ask whether HEAD resolves rather than read the message.
  const head = await runGit(repo, 'rev-parse', ['--verify', 'HEAD'], transport)
  return head.ok ? report : { ok: true, value: [] }
}

/**
 * Commit one file, and only that file: the pathspec leaves anything else staged where it was, so
 * a document commits its own change without taking the rest of the tree with it.
 */
export async function commitFile(
  repo: string,
  path: string,
  message: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  const trimmed = message.trim()
  if (trimmed === '') return failure(0, '', 'A commit needs a message.')
  // A file git does not track yet has to be added before a pathspec commit can name it.
  const staged = await runGit(repo, 'add', ['--', path], transport)
  if (!staged.ok) return staged
  const report = await runGit(repo, 'commit', ['-m', trimmed, '--', path], transport)
  return report.ok ? { ok: true, value: null } : report
}

/**
 * Put one file back as it was at a commit, in the working tree and the index. The commit itself
 * stays: this undoes a file's content, not the history around it.
 */
export async function restoreFileFromCommit(
  repo: string,
  path: string,
  commit: string,
  transport: GitTransport = invoke
): Promise<GitOutcome<null>> {
  if (!COMMIT_HASH.test(commit)) return failure(0, '', 'A commit is named by its hash.')
  const report = await runGit(repo, 'checkout', [commit, '--', path], transport)
  return report.ok ? { ok: true, value: null } : report
}

function failure(code: number, stderr: string, summary?: string): GitFailure {
  const firstLine = stderr
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '')
  return {
    ok: false,
    code,
    stderr,
    summary: summary ?? firstLine ?? 'git exited with a non-zero status.'
  }
}
