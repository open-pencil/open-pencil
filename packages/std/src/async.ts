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

export interface KeyedMutex<K> {
  /** Runs `operation` in its turn among the holders of `key`, whether the one before succeeded or not. */
  run<T>(key: K, operation: () => Promise<T> | T, signal?: AbortSignal): Promise<T>
}

/**
 * A mutex for each key, such as a file or a connection: holders of one key take turns, and
 * holders of different keys run side by side. A key's mutex is dropped once its last holder
 * finishes, so keys that come and go are not kept.
 */
export function createKeyedMutex<K>(): KeyedMutex<K> {
  const held = new Map<K, { mutex: Mutex; holders: number }>()
  return {
    async run(key, operation, signal) {
      let entry = held.get(key)
      if (!entry) {
        entry = { mutex: createMutex(), holders: 0 }
        held.set(key, entry)
      }
      entry.holders += 1
      try {
        return await entry.mutex.run(operation, signal)
      } finally {
        entry.holders -= 1
        if (entry.holders === 0) held.delete(key)
      }
    }
  }
}
