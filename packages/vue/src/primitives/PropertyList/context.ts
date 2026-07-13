import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'

import type { PropertyListContext, PropertyListKey } from './types'

const PROPERTY_LIST_KEY: InjectionKey<PropertyListContext> = Symbol('PropertyList')

export function providePropertyList<K extends PropertyListKey>(context: PropertyListContext<K>) {
  provide(PROPERTY_LIST_KEY, context as PropertyListContext)
}

export function usePropertyList<K extends PropertyListKey>(): PropertyListContext<K> {
  const context = inject(PROPERTY_LIST_KEY)
  if (!context)
    throw new Error('[open-pencil] PropertyList part must be used inside PropertyListRoot')
  return context as PropertyListContext<K>
}

export function usePropertyListPart<K extends PropertyListKey>(propKey: K): PropertyListContext<K> {
  const context = usePropertyList<K>()
  if (context.propKey !== propKey) {
    throw new Error(
      `[open-pencil] PropertyList part propKey must match PropertyListRoot (${propKey})`
    )
  }
  return context
}
