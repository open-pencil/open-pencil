<script setup lang="ts">
import { TabsRoot } from 'reka-ui'
import { normalizeClass, type HTMLAttributes } from 'vue'

import { tabs } from '@/theme/tabs/tabs'

const {
  orientation = 'horizontal',
  activationMode = 'automatic',
  class: className,
  ui
} = defineProps<{
  class?: HTMLAttributes['class']
  orientation?: 'horizontal' | 'vertical'
  activationMode?: 'automatic' | 'manual'
  ui?: { root?: string }
}>()
const modelValue = defineModel<string>({ required: true })
const styles = tabs()

function update(value: string | number) {
  if (typeof value === 'string') modelValue.value = value
}
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    :orientation="orientation"
    :activation-mode="activationMode"
    data-slot="root"
    :class="styles.root({ class: [ui?.root, normalizeClass(className)] })"
    @update:model-value="update"
  >
    <slot />
  </TabsRoot>
</template>
