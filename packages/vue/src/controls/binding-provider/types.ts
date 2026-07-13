import type { Ref } from 'vue'

import type { Variable } from '@open-pencil/scene-graph'

export type BindingState = 'unbound' | 'bound' | 'mixed'
export type BoundEditPolicy = 'detach-on-edit' | 'readonly-when-bound' | 'edit-variable'
export type BindingMutationSource = 'edit' | 'scrub' | 'step'

export interface BindingTarget {
  nodeId: string
  path: string
}

export interface BindingProvider<V = unknown> {
  /** Optional reactive revision consumed by BindableValueRoot. */
  revision?: Readonly<Ref<unknown>>
  listVariables(): Variable[]
  filterVariables(term: string): Variable[]
  getBound(target: BindingTarget): Variable | undefined
  getState(targets: BindingTarget[]): BindingState
  resolve(variableId: string): V | undefined
  bind(target: BindingTarget, variableId: string): void
  unbind(target: BindingTarget): void
  create?(target: BindingTarget, value: V, name: string): void
  setValue?(variableId: string, value: V): void
  runBatch?<T>(label: string, action: () => T): T
  beginBatch?(label: string): void
  commitBatch?(): void
  rollbackBatch?(): void
}
