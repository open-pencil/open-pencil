import type { Component, ComputedRef, VNode } from 'vue'

import type { Effect, Fill, Stroke } from '@open-pencil/scene-graph'

export interface PropertyListItemMap {
  fills: Fill
  strokes: Stroke
  effects: Effect
}

export type PropertyListKey = keyof PropertyListItemMap
export type PropertyListItemFor<K extends PropertyListKey> = PropertyListItemMap[K]
export type PropertyListPatchFor<K extends PropertyListKey> = Partial<PropertyListItemFor<K>>
export type PropertyListIdentity = string | number

export interface PropertyListActions<K extends PropertyListKey> {
  add(item: PropertyListItemFor<K>): void
  remove(index: number): void
  update(index: number, item: PropertyListItemFor<K>): void
  patch(index: number, changes: PropertyListPatchFor<K>): void
  toggleVisibility(index: number): void
  reorder(fromIndex: number, toIndex: number): void
}

export interface PropertyListContext<K extends PropertyListKey = PropertyListKey> {
  propKey: K
  items: ComputedRef<PropertyListItemFor<K>[]>
  isMixed: ComputedRef<boolean>
  disabled: ComputedRef<boolean>
  keyOf(item: PropertyListItemFor<K>, index: number): PropertyListIdentity
  actions: PropertyListActions<K>
}

export interface PropertyListRootProps<K extends PropertyListKey> {
  /** Discriminator that provides exact Fill, Stroke, or Effect types to slots and actions. */
  propKey: K
  /** Controlled list items. */
  items: PropertyListItemFor<K>[]
  /** Marks values across the current selection as inconsistent. @default false */
  mixed?: boolean
  /** Prevents item actions. @default false */
  disabled?: boolean
  /** Stable identity for keyed rows. Defaults to the item index. */
  getKey?: (item: PropertyListItemFor<K>, index: number) => PropertyListIdentity
  /** Optional accessible label exposed to consumers. */
  label?: string
}

export interface PropertyListRootSlotProps<K extends PropertyListKey> {
  items: PropertyListItemFor<K>[]
  isMixed: boolean
  disabled: boolean
  keyOf(item: PropertyListItemFor<K>, index: number): PropertyListIdentity
  actions: PropertyListActions<K>
}

export interface PropertyListRootSlots<K extends PropertyListKey> {
  default?(props: PropertyListRootSlotProps<K>): VNode[]
}

export interface PropertyListItemActions<K extends PropertyListKey> {
  update(item: PropertyListItemFor<K>): void
  patch(changes: PropertyListPatchFor<K>): void
  remove(): void
  toggleVisibility(): void
}

export interface PropertyListPartProps<K extends PropertyListKey> {
  /** Must match the nearest PropertyListRoot and preserves generic inference. */
  propKey: K
  /** Element or component rendered by this part. @default 'button' */
  as?: string | Component
  /** Merge behavior into the single child element. @default false */
  asChild?: boolean
  /** Prevent activation. @default false */
  disabled?: boolean
}

export interface PropertyListItemSlotProps<K extends PropertyListKey> {
  item: PropertyListItemFor<K> | undefined
  index: number
  hidden: boolean
  dragging: boolean
  disabled: boolean
  actions: PropertyListItemActions<K>
}
