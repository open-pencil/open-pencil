import { computed, type ComputedRef, type ShallowRef } from 'vue'

import type { ProgramTransport } from './gh'
import { compareURL, isGitHubRemote, parseRemoteURL } from './pr'
import { openPullRequest } from './pulls'
import type { GitStatus } from './schema'

/** What a pull request is opened from: the repository, its branch, and its remote. */
export type PullRequestInputs = {
  repository: ComputedRef<string>
  status: ShallowRef<GitStatus | null>
  remoteURL: ShallowRef<string | null>
  /** The branch the remote checks out, read because a pushed branch tracks its own name. */
  defaultBranch: ShallowRef<string | null>
  programTransport?: ProgramTransport
}

/**
 * The branches a pull request would be opened between, and the page it opens from when the GitHub
 * CLI is missing. Kept apart from the rest of the source-control surface so its size stays the
 * sum of its operations.
 */
export function usePullRequest(inputs: PullRequestInputs) {
  const headBranch = computed(() => inputs.status.value?.branch.head ?? null)

  /** The remote the repository pushes to, or null while it is unknown or this app cannot read it. */
  const remote = computed(() =>
    inputs.remoteURL.value === null ? null : parseRemoteURL(inputs.remoteURL.value)
  )

  /**
   * The branch a pull request would land in: the upstream's own name, unless the branch tracks
   * its own name on the remote, which says nothing about where it should land.
   */
  const baseBranch = computed(() => {
    const upstream = inputs.status.value?.branch.upstream ?? null
    const named = upstream === null ? '' : upstream.split('/').slice(1).join('/')
    if (named !== '' && named !== headBranch.value) return named
    return inputs.defaultBranch.value ?? 'main'
  })

  /**
   * The pull request this tab would open, or null when there is none to open. Working on the
   * default branch is a normal thing to do, and there is nothing between it and itself: the GitHub
   * CLI refuses `--base X --head X`, and `X...X` is a comparison page that does not exist.
   */
  const pullRequest = computed(() => {
    const head = headBranch.value
    const location = remote.value
    if (head === null || location === null) return null
    if (!isGitHubRemote(location) || head === baseBranch.value) return null
    return { location, base: baseBranch.value, head }
  })

  /** The page a pull request opens from, or null while there is no pull request to open. */
  const compareLink = computed(() => {
    const open = pullRequest.value
    return open === null ? null : compareURL(open.location, open.base, open.head)
  })

  /**
   * Open a pull request for the current branch, answering its address. A machine without `gh`,
   * or one where it is not signed in, answers null so the caller falls back to the compare page.
   */
  function createPullRequest(): Promise<string | null> {
    const current = inputs.repository.value
    const open = pullRequest.value
    return current === '' || open === null
      ? Promise.resolve(null)
      : openPullRequest(
          { repo: current, base: open.base, head: open.head },
          inputs.programTransport
        )
  }

  return { headBranch, baseBranch, compareLink, createPullRequest }
}
