import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'

import type { BindingProvider } from '#vue/controls/binding-provider/types'

export const BINDING_PROVIDER_KEY: InjectionKey<BindingProvider> = Symbol(
  'open-pencil-binding-provider'
)

export function provideBindingProvider(provider: BindingProvider) {
  provide(BINDING_PROVIDER_KEY, provider)
}

export function useBindingProvider<V>(): BindingProvider<V> | undefined {
  return inject(BINDING_PROVIDER_KEY, undefined) as BindingProvider<V> | undefined
}
