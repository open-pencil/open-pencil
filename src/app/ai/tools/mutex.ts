import { createDeferred } from '@/app/runtime/deferred'

/** Runs holders one at a time, in arrival order. `acquire` resolves with the release function. */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve()
  return async function acquire(): Promise<() => void> {
    const { promise, resolve } = createDeferred<undefined>()
    const previous = tail
    tail = previous.then(() => promise)
    await previous
    return () => resolve(undefined)
  }
}
