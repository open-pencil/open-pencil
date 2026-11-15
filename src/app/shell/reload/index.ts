/** A reload the app learns of before it happens, which waits for every step registered for it. */
export interface Reload {
  /** True when leaving asks first, as with an unsaved document, so the page may stay. */
  asks: boolean
}

type ReloadStep = (reload: Reload) => Promise<void>

const steps = new Set<ReloadStep>()

/**
 * Registers a step the page waits for before an announced reload, and returns its removal.
 * Most reloads are not announced; work that must run on every one also listens for `pagehide`.
 */
export function onBeforeReload(step: ReloadStep): () => void {
  steps.add(step)
  return () => steps.delete(step)
}

/** Runs every registered step and settles once all have, whether or not they succeeded. */
export async function announceReload(reload: Reload): Promise<void> {
  await Promise.allSettled([...steps].map((step) => step(reload)))
}
