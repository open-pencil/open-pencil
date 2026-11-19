import { untilAborted } from './timing'

export interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (reason?: unknown) => void
}

/**
 * A promise whose settlement is owned by the caller: `Promise.withResolvers()`, which is newer
 * than the browsers OpenPencil supports.
 */
export function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'] = () => undefined
  let reject: Deferred<T>['reject'] = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export interface Mutex {
  /**
   * Waits for the holder's turn and resolves with the function that ends it. A holder whose
   * signal aborts while it waits stops waiting, and its turn passes straight on.
   */
  acquire(signal?: AbortSignal): Promise<() => void>
  /** Runs `operation` in its turn, whether the one before it succeeded or failed. */
  run<T>(operation: () => Promise<T> | T, signal?: AbortSignal): Promise<T>
}

/** Holders take turns, one at a time, in the order they arrive. */
export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve()
  async function acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted()
    const { promise, resolve } = createDeferred<undefined>()
    const release = () => resolve(undefined)
    const previous = tail
    tail = previous.then(() => promise)
    if (!signal) {
      await previous
      return release
    }
    try {
      await untilAborted(previous, signal)
    } catch (error) {
      void previous.then(release)
      throw error
    }
    return release
  }
  return {
    acquire,
    async run(operation, signal) {
      const release = await acquire(signal)
      try {
        return await operation()
      } finally {
        release()
      }
    }
  }
}
