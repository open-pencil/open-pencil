<script setup lang="ts" generic="V">
import { computed, onBeforeUnmount, ref } from 'vue'

import { useBindingProvider } from '#vue/controls/binding-provider/context'
import type {
  BindingMutationSource,
  BindingProvider,
  BindingTarget
} from '#vue/controls/binding-provider/types'
import { provideBindableValue } from '#vue/primitives/BindableValue/context'
import type {
  BindableValueActions,
  BindableValueContext,
  BindableValueRootProps,
  BindableValueRootSlots,
  BindableValueSlotProps,
  BindableValueStateAttrs
} from '#vue/primitives/BindableValue/types'

const {
  provider: providerProp,
  targets: targetsProp,
  value: valueProp,
  policy: policyProp = 'detach-on-edit',
  batchLabel = 'Edit bound value'
} = defineProps<BindableValueRootProps<V>>()

defineSlots<BindableValueRootSlots<V>>()

const injectedProvider = useBindingProvider<V>()
const resolvedProvider = providerProp ?? injectedProvider
if (!resolvedProvider) {
  throw new Error(
    '[open-pencil] BindableValueRoot requires a provider prop or provideBindingProvider()'
  )
}
const provider: BindingProvider<V> = resolvedProvider
const beginProviderBatch = provider.beginBatch
const commitProviderBatch = provider.commitBatch
const rollbackProviderBatch = provider.rollbackBatch
const supportsInteractionBatch =
  beginProviderBatch !== undefined &&
  commitProviderBatch !== undefined &&
  rollbackProviderBatch !== undefined

const targets = computed(() => targetsProp)
const value = computed(() => valueProp)
const policy = computed(() => policyProp)
const open = ref(false)
const searchTerm = ref('')
const state = computed(() => {
  void provider.revision?.value
  return provider.getState(targets.value)
})
const variable = computed(() => {
  const target = targets.value[0]
  return state.value === 'bound' && target ? provider.getBound(target) : undefined
})
const resolvedValue = computed(() => {
  void provider.revision?.value
  const current = variable.value
  return current ? provider.resolve(current.id) : undefined
})
const variables = computed(() => {
  void provider.revision?.value
  return provider.filterVariables(searchTerm.value)
})
const stateAttrs = computed<BindableValueStateAttrs>(() => ({
  'data-unbound': state.value === 'unbound' ? '' : undefined,
  'data-bound': state.value === 'bound' ? '' : undefined,
  'data-mixed': state.value === 'mixed' ? '' : undefined,
  'data-picker-open': open.value ? '' : undefined,
  'data-policy': policy.value
}))

let interactionActive = false
let detachedForInteraction = false
let bindingSnapshot = new Map<BindingTarget, string>()
let resolvedSnapshot: V | undefined

function runImmediate(label: string, action: () => void) {
  if (provider.runBatch) provider.runBatch(label, action)
  else action()
}

function bind(variableId: string) {
  runImmediate('Bind variable', () => {
    for (const target of targets.value) provider.bind(target, variableId)
  })
  open.value = false
}

function unbind() {
  runImmediate('Unbind variable', () => {
    for (const target of targets.value) provider.unbind(target)
  })
}

function create(name: string) {
  const target = targets.value[0]
  if (!target || !provider.create) return
  runImmediate('Create and bind variable', () => provider.create?.(target, value.value, name))
  open.value = false
}

function openPicker() {
  open.value = true
}

function closePicker() {
  open.value = false
}

function togglePicker() {
  open.value = !open.value
}

function setSearchTerm(term: string) {
  searchTerm.value = term
}

function snapshotBindings() {
  bindingSnapshot = new Map()
  for (const target of targets.value) {
    const current = provider.getBound(target)
    if (current) bindingSnapshot.set(target, current.id)
  }
}

function beginMutation(source: BindingMutationSource): boolean {
  if (interactionActive) return true
  if (state.value === 'unbound') return true
  const startedMixed = state.value === 'mixed'
  if (!startedMixed && policy.value === 'readonly-when-bound') return false
  if (
    !startedMixed &&
    policy.value === 'edit-variable' &&
    (!variable.value || !provider.setValue)
  ) {
    return false
  }

  interactionActive = true
  void source
  snapshotBindings()
  resolvedSnapshot = resolvedValue.value
  if (supportsInteractionBatch) beginProviderBatch(batchLabel)

  if (startedMixed || policy.value === 'detach-on-edit') {
    detachedForInteraction = true
    for (const target of targets.value) provider.unbind(target)
  }
  return true
}

function applyValue(nextValue: V): boolean {
  if (policy.value !== 'edit-variable' || !interactionActive) return false
  const current = variable.value
  if (!current || !provider.setValue) return false
  provider.setValue(current.id, nextValue)
  return true
}

function resetInteraction() {
  interactionActive = false
  detachedForInteraction = false
  bindingSnapshot.clear()
  resolvedSnapshot = undefined
}

function commitMutation() {
  if (!interactionActive) return
  if (supportsInteractionBatch) commitProviderBatch()
  resetInteraction()
}

function restoreWithoutRollback() {
  if (detachedForInteraction) {
    for (const [target, variableId] of bindingSnapshot) provider.bind(target, variableId)
  } else if (
    policy.value === 'edit-variable' &&
    variable.value &&
    resolvedSnapshot !== undefined &&
    provider.setValue
  ) {
    provider.setValue(variable.value.id, resolvedSnapshot)
  }
}

function cancelMutation() {
  if (!interactionActive) return
  if (supportsInteractionBatch) rollbackProviderBatch()
  else restoreWithoutRollback()
  resetInteraction()
}

const actions: BindableValueActions<V> = {
  bind,
  unbind,
  create,
  openPicker,
  closePicker,
  togglePicker,
  setSearchTerm,
  beginMutation,
  applyValue,
  commitMutation,
  cancelMutation
}

const slotProps = computed<BindableValueSlotProps<V>>(() => ({
  state: state.value,
  variable: variable.value,
  resolvedValue: resolvedValue.value,
  policy: policy.value,
  open: open.value,
  searchTerm: searchTerm.value,
  variables: variables.value,
  stateAttrs: stateAttrs.value,
  actions
}))

const context: BindableValueContext<V> = {
  provider,
  targets,
  value,
  state,
  variable,
  resolvedValue,
  policy,
  open,
  searchTerm,
  variables,
  stateAttrs,
  slotProps,
  actions
}

provideBindableValue(context)
onBeforeUnmount(cancelMutation)
</script>

<template>
  <slot v-bind="slotProps" />
</template>
