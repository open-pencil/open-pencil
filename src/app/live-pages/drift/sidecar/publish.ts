import { DRIFT_COMMIT_MESSAGE, projectSidecarGit, type SidecarGit } from './git'
import { DRIFT_SIDECAR_PATH } from './model'
import { writeBaselines, type BaselineProject } from './run'

/** What putting the baselines into a repository before a pull request did. */
export type BaselinesPublish =
  | 'committed'
  | 'unchanged'
  | 'empty'
  | 'other-document'
  | 'unavailable'

export type PublishBaselinesInput = BaselineProject & {
  /** Git as the publish path reads it; the repository's own by default. */
  git?: SidecarGit
}

/**
 * Put the document's baselines into its project before a pull request opens, so the request
 * carries the pictures its pages were compared against. A document with no picture, a sidecar that
 * did not change, and a project that refused the write all answer without stopping the request.
 */
export async function publishBaselines(input: PublishBaselinesInput): Promise<BaselinesPublish> {
  const written = await writeBaselines(input)
  if (written.status === 'empty') return 'empty'
  if (written.status === 'other-document') return 'other-document'
  if (written.status === 'unavailable') return 'unavailable'
  const git = input.git ?? projectSidecarGit()
  const state = await git.state(input.repository, DRIFT_SIDECAR_PATH)
  if (state === null) return 'unavailable'
  if (state === 'clean') return 'unchanged'
  const committed = await git.commit(input.repository, DRIFT_SIDECAR_PATH, DRIFT_COMMIT_MESSAGE)
  return committed ? 'committed' : 'unavailable'
}
