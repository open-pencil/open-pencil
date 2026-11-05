<script setup lang="ts">
import { MenubarRoot } from 'reka-ui'
import { computed, ref } from 'vue'

import { useOverlayOpen } from '@open-pencil/vue/lifecycle/overlays'

// Reka's menubar root, counted as an open overlay while one of its menus is open. Its value is
// the open menu, empty when none is; a value the parent passes decides, as on Reka's root.
const { modelValue = undefined, defaultValue = '' } = defineProps<{
  modelValue?: string
  defaultValue?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [menu: string] }>()
const ownMenu = ref(defaultValue)
const openMenu = computed(() => modelValue ?? ownMenu.value)
useOverlayOpen(() => openMenu.value !== '')

// Reka types the event as a boolean, but sends the open menu's value, a string like `modelValue`.
function updateMenu(value: string | boolean) {
  const menu = typeof value === 'string' ? value : ''
  ownMenu.value = menu
  emit('update:modelValue', menu)
}
</script>

<template>
  <MenubarRoot :model-value="openMenu" @update:model-value="updateMenu">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </MenubarRoot>
</template>
