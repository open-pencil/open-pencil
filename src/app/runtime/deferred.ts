export interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (reason?: unknown) => void
}

/**
 * A promise whose settlement is owned by the caller.
 *
 * Equivalent to `Promise.withResolvers()`, which is newer than the supported
 * browser baseline (`@/app/shell/support/baseline`) and therefore outside the
 * ES2023 lib; `es-toolkit` offers no counterpart.
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
