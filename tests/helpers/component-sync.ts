/**
 * Flushes pending microtask queue for component sync operations.
 *
 * Used in tests that exercise component-instance synchronization, where the
 * sync logic schedules work via microtasks that need to resolve before
 * assertions can verify the propagated state.
 */
export async function flushComponentSync(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
