import type { Ref } from 'vue'

import type { Variable } from '@open-pencil/scene-graph'

export type BindingState = 'unbound' | 'bound' | 'mixed' | 'unresolved'
export type BoundEditPolicy = 'detach-on-edit' | 'readonly-when-bound' | 'edit-variable'
export type BindingMutationSource = 'edit' | 'scrub' | 'step'

export interface BindingTarget {
  nodeId: string
  path: string
}

export interface BindingValueEdit<V> {
  /** Stable identity of the variable and storage location being edited. */
  key: string
  value: V
  restore(): void
  set(value: V): void
}

export interface BindingProvider<V = unknown> {
  /** Optional reactive revision consumed by BindableValueRoot. */
  revision?: Readonly<Ref<unknown>>
  listVariables(): Variable[]
  filterVariables(term: string): Variable[]
  getBindingId(target: BindingTarget): string | undefined
  getBound(target: BindingTarget): Variable | undefined
  getState(targets: BindingTarget[]): BindingState
  resolve(variableId: string, target?: BindingTarget): V | undefined
  bind(target: BindingTarget, variableId: string): void
  unbind(target: BindingTarget): void
  create?(target: BindingTarget, value: V, name: string): void
  prepareEdit?(variableId: string, target: BindingTarget): BindingValueEdit<V> | undefined
  runBatch?<T>(label: string, action: () => T): T
  beginBatch?(label: string): void
  commitBatch?(): void
  rollbackBatch?(): void
}
