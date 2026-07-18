<script setup lang="ts">
import { ref } from 'vue'

import type { Variable } from '@open-pencil/scene-graph'
import type { BindingProvider, BindingState, BindingTarget } from '@open-pencil/vue'

import BindingFieldDemoItem from './BindingFieldDemoItem.vue'

const variables: Variable[] = [
  {
    id: 'space/sm',
    name: 'Space/sm',
    type: 'FLOAT',
    collectionId: 'demo',
    valuesByMode: { default: 8 },
    description: '',
    hiddenFromPublishing: false
  },
  {
    id: 'space/md',
    name: 'Space/md',
    type: 'FLOAT',
    collectionId: 'demo',
    valuesByMode: { default: 16 },
    description: '',
    hiddenFromPublishing: false
  },
  {
    id: 'space/lg',
    name: 'Space/lg',
    type: 'FLOAT',
    collectionId: 'demo',
    valuesByMode: { default: 24 },
    description: '',
    hiddenFromPublishing: false
  }
]

const revision = ref(0)
const bindings = ref<Record<string, string | undefined>>({
  'detach:width': 'space/md',
  'readonly:width': 'space/lg',
  'edit-variable:width': 'space/md',
  'mixed-a:width': 'space/sm',
  'mixed-b:width': 'space/lg',
  'disabled:width': 'space/md',
  'derived:width': 'space/sm'
})
const values = ref({
  unbound: 12,
  detach: 16,
  readonly: 24,
  editVariable: 16,
  mixed: 0,
  disabled: 16,
  derived: 8
})

function key(target: BindingTarget) {
  return `${target.nodeId}:${target.path}`
}

const provider: BindingProvider<number> = {
  revision,
  listVariables: () => variables,
  filterVariables: (term) =>
    variables.filter((variable) => variable.name.toLowerCase().includes(term.toLowerCase())),
  getBound: (target) => variables.find((variable) => variable.id === bindings.value[key(target)]),
  getState(targets): BindingState {
    const ids = new Set(targets.map((target) => bindings.value[key(target)]))
    if (ids.size > 1) return 'mixed'
    return ids.has(undefined) ? 'unbound' : 'bound'
  },
  resolve: (variableId) => {
    const value = variables.find((variable) => variable.id === variableId)?.valuesByMode.default
    return typeof value === 'number' ? value : undefined
  },
  bind(target, variableId) {
    bindings.value[key(target)] = variableId
    revision.value++
  },
  unbind(target) {
    bindings.value[key(target)] = undefined
    revision.value++
  },
  setValue(variableId, value) {
    const variable = variables.find((item) => item.id === variableId)
    if (variable) variable.valuesByMode.default = value
    revision.value++
  },
  create(target, value, name) {
    const id = `created:${name}`
    variables.push({
      id,
      name,
      type: 'FLOAT',
      collectionId: 'demo',
      valuesByMode: { default: value },
      description: '',
      hiddenFromPublishing: false
    })
    bindings.value[key(target)] = id
    revision.value++
  }
}

const target = (nodeId: string): BindingTarget[] => [{ nodeId, path: 'width' }]
const mixedTargets: BindingTarget[] = [
  { nodeId: 'mixed-a', path: 'width' },
  { nodeId: 'mixed-b', path: 'width' }
]
</script>

<template>
  <div class="w-[320px] overflow-hidden rounded-lg border border-border bg-panel shadow-xl">
    <header class="border-b border-border px-3 py-2">
      <p class="text-xs font-semibold">Binding field states</p>
      <p class="mt-1 text-[11px] text-muted">Pill at rest, resolved value while editing</p>
    </header>

    <div class="grid grid-cols-2 gap-1.5 px-3">
      <label class="space-y-1">
        <span class="text-[11px] text-muted">Unbound</span>
        <BindingFieldDemoItem
          v-model="values.unbound"
          label="Unbound field"
          :provider="provider"
          :targets="target('unbound')"
        />
      </label>
      <label class="space-y-1">
        <span class="text-[11px] text-muted">Detach on edit</span>
        <BindingFieldDemoItem
          v-model="values.detach"
          label="Detach bound field"
          :provider="provider"
          :targets="target('detach')"
        />
      </label>
      <label class="space-y-1">
        <span class="text-[11px] text-muted">Read only</span>
        <BindingFieldDemoItem
          v-model="values.readonly"
          label="Readonly bound field"
          :provider="provider"
          :targets="target('readonly')"
          policy="readonly-when-bound"
        />
      </label>
      <label class="space-y-1">
        <span class="text-[11px] text-muted">Edit variable</span>
        <BindingFieldDemoItem
          v-model="values.editVariable"
          label="Edit variable field"
          :provider="provider"
          :targets="target('edit-variable')"
          policy="edit-variable"
        />
      </label>
      <label class="space-y-1">
        <span class="text-[11px] text-muted">Mixed</span>
        <BindingFieldDemoItem
          v-model="values.mixed"
          label="Mixed binding field"
          :provider="provider"
          :targets="mixedTargets"
        />
      </label>
      <label class="space-y-1">
        <span class="text-[11px] text-muted">Disabled</span>
        <BindingFieldDemoItem
          v-model="values.disabled"
          label="Disabled bound field"
          :provider="provider"
          :targets="target('disabled')"
          disabled
        />
      </label>
      <label class="col-span-2 space-y-1">
        <span class="text-[11px] text-muted">Derived by auto layout</span>
        <BindingFieldDemoItem
          v-model="values.derived"
          label="Derived bound field"
          :provider="provider"
          :targets="target('derived')"
          derived
        />
      </label>
    </div>
  </div>
</template>
