import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'

import type { BindableValueContext } from '#vue/primitives/BindableValue/types'

export const BINDABLE_VALUE_KEY: InjectionKey<BindableValueContext> = Symbol('BindableValue')

export function provideBindableValue<V>(context: BindableValueContext<V>) {
  provide(BINDABLE_VALUE_KEY, context as BindableValueContext)
}

export function useBindableValue<V>(): BindableValueContext<V> {
  const context = inject(BINDABLE_VALUE_KEY)
  if (!context)
    throw new Error('[open-pencil] BindableValue part must be used inside BindableValueRoot')
  return context as BindableValueContext<V>
}

export function useOptionalBindableValue<V>(): BindableValueContext<V> | undefined {
  return inject(BINDABLE_VALUE_KEY) as BindableValueContext<V> | undefined
}
