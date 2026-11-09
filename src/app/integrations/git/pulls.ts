import { createPullRequestViaGH, type ProgramTransport } from './gh'

/** The branches a pull request is opened between. */
export type PullRequestBranches = {
  repo: string
  base: string
  head: string
}

/**
 * Open a pull request for the current branch, or answer null when the GitHub CLI is missing or
 * signed out. The title and body are this app's own wording: the request is about the branch, and
 * the person edits both on the page it opens.
 */
export function openPullRequest(
  branches: PullRequestBranches,
  transport?: ProgramTransport
): Promise<string | null> {
  return createPullRequestViaGH(
    {
      ...branches,
      title: `Design changes from ${branches.head}`,
      body: 'Opened from OpenPencil.'
    },
    transport
  )
}
