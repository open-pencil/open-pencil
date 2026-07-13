<script setup lang="ts">
import { ref } from 'vue'

import type { Variable } from '@open-pencil/scene-graph'

import type {
  BindingProvider,
  BindingState,
  BindingTarget
} from '#vue/controls/binding-provider/types'
import BindableValuePicker from '#vue/primitives/BindableValue/BindableValuePicker.vue'
import BindableValueRoot from '#vue/primitives/BindableValue/BindableValueRoot.vue'
import BindableValueTrigger from '#vue/primitives/BindableValue/BindableValueTrigger.vue'
import NumberFieldInput from '#vue/primitives/NumberField/NumberFieldInput.vue'
import NumberFieldRoot from '#vue/primitives/NumberField/NumberFieldRoot.vue'
import NumberFieldValue from '#vue/primitives/NumberField/NumberFieldValue.vue'

const variables: Variable[] = [
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
  'mixed-a:width': 'space/md',
  'mixed-b:width': 'space/lg'
})
const detachValue = ref(8)
const readonlyValue = ref(8)
const editVariableValue = ref(8)
const pickerValue = ref(12)

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
  resolve: (variableId) =>
    variables.find((variable) => variable.id === variableId)?.valuesByMode.default as
      | number
      | undefined,
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

const detachTarget: BindingTarget[] = [{ nodeId: 'detach', path: 'width' }]
const readonlyTarget: BindingTarget[] = [{ nodeId: 'readonly', path: 'width' }]
const editVariableTarget: BindingTarget[] = [{ nodeId: 'edit-variable', path: 'width' }]
const mixedTargets: BindingTarget[] = [
  { nodeId: 'mixed-a', path: 'width' },
  { nodeId: 'mixed-b', path: 'width' }
]
const pickerTarget: BindingTarget[] = [{ nodeId: 'picker', path: 'width' }]
</script>

<template>
  <div
    class="w-full max-w-[560px] space-y-5 rounded-lg border border-[var(--vp-c-divider)] bg-[var(--vp-c-bg-soft)] p-5 text-[var(--vp-c-text-1)]"
  >
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <p class="mb-1 text-[11px] text-[var(--vp-c-text-2)]">Detach on edit</p>
        <BindableValueRoot
          v-slot="{ stateAttrs }"
          :provider="provider"
          :targets="detachTarget"
          :value="detachValue"
        >
          <NumberFieldRoot
            v-slot="{ attrs, editing, actions }"
            v-model="detachValue"
            aria-label="Detach bound value"
          >
            <div
              v-bind="{ ...attrs, ...stateAttrs }"
              class="flex h-[26px] items-center rounded bg-[var(--vp-c-bg-alt)] px-2 text-xs data-[bound]:text-[var(--vp-c-brand-1)]"
              @pointerdown="!editing && actions.startScrub($event)"
            >
              <NumberFieldInput class="min-w-0 flex-1 bg-transparent outline-none" />
              <NumberFieldValue />
            </div>
          </NumberFieldRoot>
        </BindableValueRoot>
      </div>

      <div>
        <p class="mb-1 text-[11px] text-[var(--vp-c-text-2)]">Read-only bound</p>
        <BindableValueRoot
          v-slot="{ stateAttrs }"
          :provider="provider"
          :targets="readonlyTarget"
          :value="readonlyValue"
          policy="readonly-when-bound"
        >
          <NumberFieldRoot
            v-slot="{ attrs, editing, actions }"
            v-model="readonlyValue"
            aria-label="Readonly bound value"
          >
            <div
              v-bind="{ ...attrs, ...stateAttrs }"
              class="flex h-[26px] items-center rounded bg-[var(--vp-c-bg-alt)] px-2 text-xs data-[bound]:text-[var(--vp-c-brand-1)]"
              @pointerdown="!editing && actions.startScrub($event)"
            >
              <NumberFieldInput class="min-w-0 flex-1 bg-transparent outline-none" />
              <NumberFieldValue />
            </div>
          </NumberFieldRoot>
        </BindableValueRoot>
      </div>

      <div>
        <p class="mb-1 text-[11px] text-[var(--vp-c-text-2)]">Edit variable</p>
        <BindableValueRoot
          v-slot="{ stateAttrs }"
          :provider="provider"
          :targets="editVariableTarget"
          :value="editVariableValue"
          policy="edit-variable"
        >
          <NumberFieldRoot
            v-slot="{ attrs, editing, actions }"
            v-model="editVariableValue"
            aria-label="Edit bound variable"
          >
            <div
              v-bind="{ ...attrs, ...stateAttrs }"
              class="flex h-[26px] items-center rounded bg-[var(--vp-c-bg-alt)] px-2 text-xs data-[bound]:text-[var(--vp-c-brand-1)]"
              @pointerdown="!editing && actions.startScrub($event)"
            >
              <NumberFieldInput class="min-w-0 flex-1 bg-transparent outline-none" />
              <NumberFieldValue />
            </div>
          </NumberFieldRoot>
        </BindableValueRoot>
      </div>

      <div>
        <p class="mb-1 text-[11px] text-[var(--vp-c-text-2)]">Mixed bindings</p>
        <BindableValueRoot
          v-slot="{ state, stateAttrs }"
          :provider="provider"
          :targets="mixedTargets"
          :value="0"
        >
          <div
            v-bind="stateAttrs"
            class="flex h-[26px] items-center rounded bg-[var(--vp-c-bg-alt)] px-2 text-xs text-[var(--vp-c-text-2)]"
            aria-label="Mixed binding value"
          >
            {{ state }}
          </div>
        </BindableValueRoot>
      </div>
    </div>

    <BindableValueRoot
      v-slot="{ open, stateAttrs }"
      :provider="provider"
      :targets="pickerTarget"
      :value="pickerValue"
    >
      <div v-bind="stateAttrs" class="relative">
        <BindableValueTrigger
          class="rounded bg-[var(--vp-c-bg-alt)] px-2 py-1 text-xs"
          aria-label="Choose binding"
        >
          Choose variable
        </BindableValueTrigger>
        <BindableValuePicker v-if="open" v-slot="{ variables: options, actions }">
          <div
            class="absolute top-full left-0 z-10 mt-1 w-40 rounded border border-[var(--vp-c-divider)] bg-[var(--vp-c-bg-soft)] p-1"
          >
            <button
              v-for="option in options"
              :key="option.id"
              class="block w-full rounded px-2 py-1 text-left text-xs hover:bg-[var(--vp-c-bg-alt)]"
              type="button"
              @click="actions.bind(option.id)"
            >
              {{ option.name }}
            </button>
          </div>
        </BindableValuePicker>
      </div>
    </BindableValueRoot>
  </div>
</template>
