import { computed, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'

import {
  commitStaged,
  DEFAULT_GIT_REMOTE,
  fetchRemote,
  type GitFailure,
  type GitOutcome,
  type GitTransport,
  listGitBranches,
  pullFastForward,
  pushCurrentBranch,
  readFileDiff,
  readDefaultBranch,
  readGitAvailability,
  readGitStatus,
  readRemoteURL,
  stageAllChanges,
  stashChanges,
  switchBranch as switchToBranch
} from './client'
import type { ProgramTransport } from './gh'
import { usePullRequest } from './request'
import type { GitAvailability, GitBranch, GitFileKind, GitStatus, GitStatusEntry } from './schema'

/** The patch the panel shows in place of the file list, and whether it is still being read. */
export type GitDiff = {
  path: string
  kind: GitFileKind
  patch: string
  reading: boolean
}

/**
 * State and operations behind the source-control surface, for one repository. The repository
 * comes from the caller — the project the panel belongs to — so a project switch is followed
 * instead of a global choice, and every operation reports whether it succeeded so the panel
 * keeps its own pending and error state.
 */
export function useSourceControl(
  repository: MaybeRefOrGetter<string>,
  transport?: GitTransport,
  programTransport?: ProgramTransport
) {
  const availability = shallowRef<GitAvailability | null>(null)
  const status = shallowRef<GitStatus | null>(null)
  const branches = shallowRef<GitBranch[]>([])
  const failure = shallowRef<GitFailure | null>(null)
  const busy = ref(false)
  const commitMessage = ref('')
  /** The file whose patch the panel shows, and the path it is open for. */
  const diff = shallowRef<GitDiff | null>(null)
  /** The remote the repository pushes to, once it has been read. */
  const remoteURL = shallowRef<string | null>(null)
  /** The branch the remote checks out, which is where a pull request lands when nothing else says. */
  const defaultBranch = shallowRef<string | null>(null)
  let openPath = ''

  /** The repository this surface answers for, read fresh so a project switch is followed. */
  const path = computed(() => toValue(repository).trim())
  const changedCount = computed(() => status.value?.entries.length ?? 0)
  const canCommit = computed(
    () => !busy.value && changedCount.value > 0 && commitMessage.value.trim() !== ''
  )
  const request = usePullRequest({
    repository: path,
    status,
    remoteURL,
    defaultBranch,
    programTransport
  })

  // Another project's branch and files must never be drawn under this project's name.
  watch(path, () => {
    availability.value = null
    status.value = null
    branches.value = []
    failure.value = null
    remoteURL.value = null
    defaultBranch.value = null
    closeDiff()
  })

  async function perform(operation: () => Promise<GitOutcome<unknown>>): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    failure.value = null
    try {
      const outcome = await operation()
      if (outcome.ok) return true
      failure.value = outcome
      return false
    } finally {
      busy.value = false
    }
  }

  /** Read the branch, the working tree, and the local branches of the current repository. */
  async function refresh(): Promise<void> {
    const current = path.value
    // A patch belongs to the tree it was read from; a fresh read may have changed it.
    closeDiff()
    if (current === '') {
      availability.value = null
      status.value = null
      branches.value = []
      failure.value = null
      remoteURL.value = null
      defaultBranch.value = null
      return
    }

    const available = await readGitAvailability(transport)
    // A project switched meanwhile must not write the previous repository's state.
    if (path.value !== current) return
    if (!available.ok) {
      availability.value = null
      failure.value = available
      status.value = null
      branches.value = []
      return
    }
    availability.value = available.value

    const read = await readGitStatus(current, transport)
    if (path.value !== current) return
    if (!read.ok) {
      failure.value = read
      status.value = null
      return
    }
    status.value = read.value
    failure.value = null

    const list = await listGitBranches(current, transport)
    if (path.value !== current) return
    branches.value = list.ok ? list.value : []

    const remote = await readRemoteURL(current, DEFAULT_GIT_REMOTE, transport)
    if (path.value !== current) return
    remoteURL.value = remote.ok ? remote.value : null

    const fallback = await readDefaultBranch(current, DEFAULT_GIT_REMOTE, transport)
    if (path.value !== current) return
    defaultBranch.value = fallback.ok ? fallback.value : null
  }

  /** Stage everything, commit it, then read the tree again. */
  async function commit(): Promise<boolean> {
    const current = path.value
    if (!(await perform(() => stageAllChanges(current, transport)))) return false
    if (!(await perform(() => commitStaged(current, commitMessage.value, transport)))) return false
    commitMessage.value = ''
    await refresh()
    return true
  }

  async function push(): Promise<boolean> {
    const current = path.value
    const pushed = await perform(() => pushCurrentBranch(current, transport))
    if (pushed) await refresh()
    return pushed
  }

  /** Switch to a branch, creating it first when `create` is set. */
  async function checkout(name: string, create = false): Promise<boolean> {
    const current = path.value
    const switched = await perform(() => switchToBranch(current, name, create, transport))
    if (switched) await refresh()
    return switched
  }

  /** Ask the remote what it has, so ahead and behind count against what is really there. */
  async function fetchBranches(): Promise<boolean> {
    const current = path.value
    const fetched = await perform(() => fetchRemote(current, transport))
    if (fetched) await refresh()
    return fetched
  }

  async function pull(): Promise<boolean> {
    const current = path.value
    const pulled = await perform(() => pullFastForward(current, transport))
    if (pulled) await refresh()
    return pulled
  }

  async function stash(): Promise<boolean> {
    const current = path.value
    const stashed = await perform(() => stashChanges(current, transport))
    if (stashed) await refresh()
    return stashed
  }

  /**
   * Read one file's patch against the last commit. An untracked file has none: git does not know
   * it yet, so the panel says so instead of showing an empty patch.
   */
  async function showDiff(entry: GitStatusEntry): Promise<void> {
    const current = path.value
    openPath = entry.path
    if (entry.kind === 'untracked') {
      diff.value = { path: entry.path, kind: entry.kind, patch: '', reading: false }
      return
    }
    diff.value = { path: entry.path, kind: entry.kind, patch: '', reading: true }
    const outcome = await readFileDiff(current, entry.path, transport)
    // A patch read for a project that changed, or for a file the panel left, is not this one's.
    if (path.value !== current || openPath !== entry.path) return
    diff.value = {
      path: entry.path,
      kind: entry.kind,
      patch: outcome.ok ? outcome.value : outcome.summary,
      reading: false
    }
  }

  function closeDiff(): void {
    openPath = ''
    diff.value = null
  }

  return {
    repository: path,
    availability,
    status,
    branches,
    failure,
    busy,
    commitMessage,
    changedCount,
    canCommit,
    diff,
    remoteURL,
    ...request,
    refresh,
    commit,
    push,
    checkout,
    fetchBranches,
    pull,
    stash,
    showDiff,
    closeDiff
  }
}
