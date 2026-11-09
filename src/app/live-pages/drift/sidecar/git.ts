import { commitFile, readFileState } from '@/app/integrations/git/client'
import type { GitFileState } from '@/app/integrations/git/schema'

/** How a project's sidecar stands in its working tree, and how a baselines commit is made. */
export type SidecarGit = {
  state(repository: string, path: string): Promise<GitFileState | null>
  commit(repository: string, path: string, message: string): Promise<boolean>
}

/** The message a baselines commit carries, which is the same whatever the design changed. */
export const DRIFT_COMMIT_MESSAGE = 'chore: record page baselines'

/**
 * Git as the publish path uses it: how the sidecar stands, so an unchanged one is not committed
 * again, and a commit of that one path, so the rest of the working tree is left where it was.
 */
export function projectSidecarGit(): SidecarGit {
  return {
    async state(repository, path) {
      const state = await readFileState(repository, path)
      return state.ok ? state.value : null
    },
    async commit(repository, path, message) {
      const commit = await commitFile(repository, path, message)
      if (!commit.ok) console.warn('[Drift] The baselines could not be committed:', commit.summary)
      return commit.ok
    }
  }
}
