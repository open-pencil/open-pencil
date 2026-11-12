import { invoke } from '@tauri-apps/api/core'
import { dirname, relative } from 'pathe'
import { computed, ref, shallowRef } from 'vue'

import {
  commitFile,
  type GitFailure,
  type GitTransport,
  listGitBranches,
  pullFastForward,
  readFileHistory,
  readFileState,
  readGitStatus,
  readRepositoryRoot,
  restoreFileFromCommit,
  switchBranch
} from './client'
import type { GitBranch, GitBranchState, GitCommitSummary, GitFileState } from './schema'

/**
 * The document the panel versions: where it saves, whether the file holds what is on screen, and
 * how to read it back after git replaced it. An editor store satisfies this as it is.
 */
export type VersionedDocument = {
  getDocumentFilePath: () => string | null
  hasUnsavedChanges: () => boolean
  saveFigFile: () => Promise<boolean>
  /** Reads the file again, answering once the document holds what the file holds. */
  reloadDocumentFromDisk: () => Promise<void>
}

/**
 * Git for one open document: the branch its repository is on, how the file itself stands against
 * the last commit, and the actions that touch that file alone. The repository is found from the
 * file, so any document saved inside a worktree is versioned without being registered anywhere.
 */
export function useDocumentGit(document: VersionedDocument, transport: GitTransport = invoke) {
  /** Where the document saves; null while it has never been written to a file. */
  const path = ref<string | null>(null)
  /** The repository holding that file, or null when it is outside every repository. */
  const root = ref<string | null>(null)
  const branch = shallowRef<GitBranchState | null>(null)
  /** How the file itself stands, which is what the panel acts on. */
  const state = shallowRef<GitFileState | null>(null)
  const branches = ref<GitBranch[]>([])
  /** Other files the repository reports as changed, so one file's commit is not the whole story. */
  const others = ref(0)
  const history = ref<GitCommitSummary[]>([])
  /** Whether the history has been read, so an empty list can be told from one not asked for. */
  const historyLoaded = ref(false)
  const reading = ref(false)
  const busy = ref(false)
  const failure = shallowRef<GitFailure | null>(null)
  const commitMessage = ref('')
  /** Counts reads, so one a newer read overtook is dropped instead of applied to the panel. */
  let reads = 0

  /** The document's path inside its repository, which is how git names the file. */
  const relativePath = computed(() => {
    const file = path.value
    const repository = root.value
    if (!file || !repository) return null
    const inside = relative(repository, file)
    return inside === '' || inside.startsWith('..') ? null : inside
  })

  /** Whether git can see this document at all, which is what the panel leads with. */
  const versioned = computed(() => root.value !== null && relativePath.value !== null)

  const canCommit = computed(
    () =>
      !busy.value &&
      versioned.value &&
      state.value !== null &&
      state.value !== 'clean' &&
      commitMessage.value.trim() !== ''
  )

  function forgetRepository(): void {
    root.value = null
    branch.value = null
    state.value = null
    branches.value = []
    others.value = 0
    history.value = []
    historyLoaded.value = false
  }

  /**
   * Read everything the panel shows again: the repository, its branches, how the file itself
   * stands, and the versions of it. The history is read here rather than beside this call because
   * it is asked for by the file's path inside its repository, which only this read knows.
   */
  async function refresh(): Promise<void> {
    const file = document.getDocumentFilePath()
    const mine = ++reads
    path.value = file
    failure.value = null
    if (!file) {
      forgetRepository()
      return
    }
    reading.value = true
    try {
      const resolved = await readRepositoryRoot(dirname(file), transport)
      // The document was saved somewhere else, or read again, while git looked: that later read
      // owns the panel, and this one would only show what is no longer open.
      if (mine !== reads) return
      if (!resolved.ok) {
        failure.value = resolved
        forgetRepository()
        return
      }
      if (resolved.value === null) {
        forgetRepository()
        return
      }
      root.value = resolved.value
      const inside = relativePath.value
      if (inside === null) {
        forgetRepository()
        return
      }
      const [status, fileState, list] = await Promise.all([
        readGitStatus(resolved.value, transport),
        readFileState(resolved.value, inside, transport),
        listGitBranches(resolved.value, transport)
      ])
      if (mine !== reads) return
      if (!status.ok) {
        failure.value = status
        return
      }
      if (!fileState.ok) {
        failure.value = fileState
        return
      }
      branch.value = status.value.branch
      state.value = fileState.value
      others.value = status.value.entries.filter((entry) => entry.path !== inside).length
      branches.value = list.ok ? list.value : []
      await readHistory(() => mine === reads)
    } finally {
      reading.value = false
    }
  }

  async function run(action: () => Promise<void>): Promise<void> {
    if (busy.value) return
    busy.value = true
    failure.value = null
    try {
      await action()
    } finally {
      busy.value = false
    }
  }

  /** Git acts on the file, so what is on screen has to reach it first. */
  async function saveBefore(): Promise<boolean> {
    if (!document.hasUnsavedChanges()) return true
    return document.saveFigFile()
  }

  /**
   * Read the document again after git replaced its file, unless the person has edits in it. The
   * wait matters: the panel stays busy, and its buttons disabled, until the document really holds
   * the version git left behind.
   */
  async function reloadDocument(): Promise<void> {
    if (document.hasUnsavedChanges()) return
    await document.reloadDocumentFromDisk()
  }

  /** Commit this file alone, saving the document first so the commit holds what is on screen. */
  async function commit(): Promise<void> {
    const repository = root.value
    const file = relativePath.value
    if (!repository || !file || !canCommit.value) return
    await run(async () => {
      if (!(await saveBefore())) return
      const outcome = await commitFile(repository, file, commitMessage.value, transport)
      if (!outcome.ok) {
        failure.value = outcome
        return
      }
      commitMessage.value = ''
      await refresh()
    })
  }

  /** Bring the branch up to date, then show the file as git left it. */
  async function sync(): Promise<void> {
    const repository = root.value
    if (!repository) return
    await run(async () => {
      if (!(await saveBefore())) return
      const outcome = await pullFastForward(repository, transport)
      if (!outcome.ok) {
        failure.value = outcome
        return
      }
      await refresh()
      await reloadDocument()
    })
  }

  /** Switch the repository to another branch, showing the document as that branch holds it. */
  async function switchTo(name: string): Promise<void> {
    const repository = root.value
    if (!repository) return
    await run(async () => {
      if (!(await saveBefore())) return
      const outcome = await switchBranch(repository, name, false, transport)
      if (!outcome.ok) {
        failure.value = outcome
        return
      }
      await refresh()
      await reloadDocument()
    })
  }

  /**
   * Read the versions of the file the repository currently shows. `stillWanted` lets a read that
   * a newer one overtook leave the panel to that one instead of writing a stale list into it.
   */
  async function readHistory(stillWanted: () => boolean = () => true): Promise<void> {
    const repository = root.value
    const file = relativePath.value
    if (!repository || !file) return
    const outcome = await readFileHistory(repository, file, transport)
    if (!stillWanted()) return
    if (!outcome.ok) {
      failure.value = outcome
      return
    }
    history.value = outcome.value
    historyLoaded.value = true
  }

  /** The versions of this file, newest first, without reading the rest of the panel again. */
  async function loadHistory(): Promise<void> {
    await run(readHistory)
  }

  /**
   * Put the file back as it was at a commit. The caller asks first: the version replaces what the
   * document holds, so anything unsaved goes with it.
   */
  async function restore(commitHash: string): Promise<void> {
    const repository = root.value
    const file = relativePath.value
    if (!repository || !file) return
    await run(async () => {
      const outcome = await restoreFileFromCommit(repository, file, commitHash, transport)
      if (!outcome.ok) {
        failure.value = outcome
        return
      }
      await refresh()
      // The version the person asked for replaces what is on screen whatever it held, so the read
      // happens here rather than through `reloadDocument`, and it is waited for as well.
      await document.reloadDocumentFromDisk()
    })
  }

  function dismissFailure(): void {
    failure.value = null
  }

  return {
    path,
    root,
    branch,
    state,
    branches,
    others,
    history,
    historyLoaded,
    reading,
    busy,
    failure,
    commitMessage,
    relativePath,
    versioned,
    canCommit,
    refresh,
    commit,
    sync,
    switchTo,
    loadHistory,
    restore,
    dismissFailure
  }
}

export type DocumentGit = ReturnType<typeof useDocumentGit>
