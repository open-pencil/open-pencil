import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * The workspace a person picked on the approval page, for the one decision being answered: the
 * approval route runs the OAuth provider's steps inside `withWorkspace`, and the provider reads
 * the pick back as the grant's `referenceId`, which every token the grant issues carries. Bound
 * to the decision rather than the session, two approvals in one browser never see each other's
 * pick, and a request the person did not answer here has none, so the provider asks again.
 */
const chosen = new AsyncLocalStorage<string>()

/** Runs the provider's steps for a decision with the workspace its person picked. */
export function withWorkspace<T>(workspaceId: string, steps: () => Promise<T>): Promise<T> {
  return chosen.run(workspaceId, steps)
}

/** The workspace picked for the decision being answered, if one is. */
export function chosenWorkspace(): string | undefined {
  return chosen.getStore()
}
