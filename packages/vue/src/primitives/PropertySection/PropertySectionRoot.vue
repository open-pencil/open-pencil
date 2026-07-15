<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue'
import { CollapsibleRoot } from 'reka-ui'

import { providePropertySection } from '#vue/primitives/PropertySection/context'
import type {
  PropertySectionActionAPI,
  PropertySectionRootProps,
  PropertySectionRootSlots,
  PropertySectionSlotProps,
  PropertySectionStateAttrs
} from '#vue/primitives/PropertySection/types'

const {
  open: openProp,
  defaultOpen = true,
  empty: emptyProp = false,
  disabled: disabledProp = false,
  unmountOnHide = false
} = defineProps<PropertySectionRootProps>()

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()
defineSlots<PropertySectionRootSlots>()
defineOptions({ inheritAttrs: false })

const vnodeProps = getCurrentInstance()?.vnode.props
const controlled = vnodeProps ? Object.hasOwn(vnodeProps, 'open') : false
const uncontrolledOpen = ref(defaultOpen)
const open = computed({
  get: () => (controlled ? openProp : uncontrolledOpen.value),
  set: (value: boolean) => {
    if (!controlled) uncontrolledOpen.value = value
    emit('update:open', value)
  }
})
const empty = computed(() => emptyProp)
const disabled = computed(() => disabledProp)
const stateAttrs = computed<PropertySectionStateAttrs>(() => ({
  'data-state': open.value ? 'open' : 'closed',
  'data-empty': empty.value ? '' : undefined,
  'data-disabled': disabled.value ? '' : undefined
}))

const actions: PropertySectionActionAPI = {
  open: () => {
    if (!disabled.value) open.value = true
  },
  close: () => {
    if (!disabled.value) open.value = false
  },
  toggle: () => {
    if (!disabled.value) open.value = !open.value
  }
}
const slotProps = computed<PropertySectionSlotProps>(() => ({
  open: open.value,
  empty: empty.value,
  stateAttrs: stateAttrs.value,
  actions
}))

providePropertySection({ open, empty, disabled, stateAttrs, slotProps, actions })
</script>

<template>
  <CollapsibleRoot
    v-bind="{ ...$attrs, ...stateAttrs }"
    :open="open"
    :disabled="disabled"
    :unmount-on-hide="unmountOnHide"
    @update:open="open = $event"
  >
    <slot v-bind="slotProps" />
  </CollapsibleRoot>
</template>
