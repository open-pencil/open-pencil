import type { GitBranchState, GitStatus, GitStatusEntry } from './schema'

/**
 * Records come from `git status --porcelain=v2 --branch -z`, whose format git documents as:
 *
 * ```
 * # branch.oid <sha> | # branch.head <name> | # branch.upstream <name> | # branch.ab +<ahead> -<behind>
 * 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
 * 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path> NUL <originalPath>
 * u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
 * ? <path> | ! <path>
 * ```
 *
 * With `-z` each record ends in NUL instead of a newline, paths are treated verbatim, and a
 * renamed entry carries its original path in the following record.
 */
const BRANCH_HEADER = '# '
const CHANGED = '1 '
const RENAMED = '2 '
const UNMERGED = 'u '
const UNTRACKED = '? '
const IGNORED = '! '
const DETACHED_HEAD = '(detached)'
const UNBORN_OID = '(initial)'
const BRANCH_AB = /^\+(?<ahead>\d+) -(?<behind>\d+)$/

/** Field counts before `<path>` for the record kinds that carry a status pair. */
const FIELDS_BEFORE_PATH = { changed: 8, renamed: 9, unmerged: 10 } as const

type MutableBranch = {
  head: string | null
  oid: string | null
  upstream: string | null
  detached: boolean
  ahead: number
  behind: number
}

/**
 * Read the porcelain v2 stream into a status a panel can render. The parser never trusts the
 * shape of the input: an unknown record is skipped rather than thrown on, since git may add
 * record kinds.
 */
export function parseGitStatus(stdout: string): GitStatus {
  const records = stdout.split('\0')
  const entries: GitStatusEntry[] = []
  const branch: MutableBranch = {
    head: null,
    oid: null,
    upstream: null,
    detached: false,
    ahead: 0,
    behind: 0
  }

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? ''
    if (record === '') continue

    if (record.startsWith(BRANCH_HEADER)) {
      applyBranchHeader(branch, record.slice(BRANCH_HEADER.length))
      continue
    }
    if (record.startsWith(UNTRACKED)) {
      entries.push(entry('untracked', '.', '.', record.slice(UNTRACKED.length)))
      continue
    }
    if (record.startsWith(IGNORED)) {
      entries.push(entry('ignored', '.', '.', record.slice(IGNORED.length)))
      continue
    }
    if (record.startsWith(RENAMED)) {
      entries.push(readRename(record, records[index + 1]))
      // The original path arrived as its own record.
      index += 1
      continue
    }
    if (record.startsWith(UNMERGED)) {
      const walk = readPair(record, FIELDS_BEFORE_PATH.unmerged)
      entries.push(entry('unmerged', walk.index, walk.worktree, walk.path))
      continue
    }
    if (record.startsWith(CHANGED)) {
      const walk = readPair(record, FIELDS_BEFORE_PATH.changed)
      entries.push(entry('changed', walk.index, walk.worktree, walk.path))
    }
  }

  return { branch, entries }
}

function entry(
  kind: GitStatusEntry['kind'],
  index: string,
  worktree: string,
  path: string,
  originalPath?: string
): GitStatusEntry {
  return originalPath === undefined
    ? { kind, index, worktree, path }
    : { kind, index, worktree, path, originalPath }
}

/** Read the `XY` pair and the path of a `1 ` or `u ` record; the path may hold spaces. */
function readPair(
  record: string,
  fieldsBeforePath: number
): { index: string; worktree: string; path: string } {
  const fields = record.split(' ')
  const xy = fields[1] ?? ''
  return {
    index: xy.slice(0, 1),
    worktree: xy.slice(1, 2),
    path: fields.slice(fieldsBeforePath).join(' ')
  }
}

function readRename(record: string, originalPath: string | undefined): GitStatusEntry {
  const fields = record.split(' ')
  const xy = fields[1] ?? ''
  return entry(
    'renamed',
    xy.slice(0, 1),
    xy.slice(1, 2),
    fields.slice(FIELDS_BEFORE_PATH.renamed).join(' '),
    originalPath === '' ? undefined : originalPath
  )
}

function applyBranchHeader(branch: MutableBranch, header: string): void {
  const [key = '', ...rest] = header.split(' ')
  const value = rest.join(' ')

  if (key === 'branch.oid') {
    branch.oid = value === UNBORN_OID ? null : value
    return
  }
  if (key === 'branch.head') {
    branch.detached = value === DETACHED_HEAD
    branch.head = branch.detached ? null : value
    return
  }
  if (key === 'branch.upstream') {
    branch.upstream = value
    return
  }
  if (key === 'branch.ab') {
    const parsed = BRANCH_AB.exec(value)
    branch.ahead = Number(parsed?.groups?.ahead ?? 0)
    branch.behind = Number(parsed?.groups?.behind ?? 0)
  }
}

/** The branch state alone, for callers that only need the header. */
export function readBranchState(status: GitStatus): GitBranchState {
  return status.branch
}
