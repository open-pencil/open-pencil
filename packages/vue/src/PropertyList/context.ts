import { type InjectionKey, inject, provide } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core'
import type { ComputedRef } from 'vue'

type ArrayPropKey = 'fills' | 'strokes' | 'effects'

export interface PropertyListContext<T = unknown> {
  editor: Editor
  propKey: ArrayPropKey
  items: ComputedRef<T[]>
  isMixed: ComputedRef<boolean>
  activeNode: ComputedRef<SceneNode | null>
  isMulti: ComputedRef<boolean>
  add: (defaults: T) => void
  remove: (index: number) => void
  update: (index: number, item: T) => void
  patch: (index: number, changes: Partial<T>) => void
  toggleVisibility: (index: number) => void
}

const PROPERTY_LIST_KEY: InjectionKey<PropertyListContext> = Symbol('property-list')

export function providePropertyList<T>(ctx: PropertyListContext<T>) {
  provide(PROPERTY_LIST_KEY, ctx as PropertyListContext)
}

export function usePropertyList<T = unknown>(): PropertyListContext<T> {
  const ctx = inject(PROPERTY_LIST_KEY)
  if (!ctx) throw new Error('[open-pencil] usePropertyList() called outside <PropertyListRoot>')
  return ctx as PropertyListContext<T>
}
