import type { InjectionKey } from 'vue'
import { inject, provide } from 'vue'

export function createContext<T>(name: string) {
  const key: InjectionKey<T> = Symbol(name)

  const provideContext = (value: T) => {
    provide(key, value)
    return value
  }

  const injectContext = (): T => {
    const value = inject(key)
    if (!value) {
      throw new Error(`[open-pencil] Injection \`${name}\` not found. Component must be used within the corresponding Root.`)
    }
    return value
  }

  return [injectContext, provideContext] as const
}
