import { effectScope } from 'vue'

/**
 * Wraps a store factory so each store runs in an effect scope of its own, stopped by `dispose`.
 * Effects a store creates inside a component's setup would otherwise join that component's
 * scope and keep the store, with its whole document, alive after its tab closes.
 */
export function scopedStoreFactory<Args extends unknown[], Store extends { dispose(): void }>(
  build: (...args: Args) => Store
): (...args: Args) => Store {
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
    return store
  }
}
