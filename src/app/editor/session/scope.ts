import { effectScope } from 'vue'

export interface ScopedStore {
  /**
   * Run `fn` in the store's effect scope, so watchers it starts stop when the store disposes.
   * For effects started after the store exists, such as after an `await`, which no scope holds.
   */
  runInScope<T>(fn: () => T): T | undefined
}

/**
 * Wraps a store factory so each store runs in an effect scope of its own, stopped by `dispose`.
 * Effects a store creates inside a component's setup would otherwise join that component's
 * scope and keep the store, with its whole document, alive after its tab closes.
 */
export function scopedStoreFactory<Args extends unknown[], Store extends { dispose(): void }>(
  build: (...args: Args) => Store
): (...args: Args) => Store & ScopedStore {
  return (...args) => {
    const scope = effectScope(true)
    let store: Store | undefined
    try {
      store = scope.run(() => build(...args))
    } catch (error) {
      scope.stop()
      throw error
    }
    if (!store) throw new Error('Editor store scope is inactive')
    const dispose = store.dispose.bind(store)
    store.dispose = () => {
      dispose()
      scope.stop()
    }
    // A disposed store runs nothing: its scope no longer collects effects to stop.
    const runInScope = <T>(fn: () => T): T | undefined => (scope.active ? scope.run(fn) : undefined)
    return Object.assign(store, { runInScope })
  }
}
