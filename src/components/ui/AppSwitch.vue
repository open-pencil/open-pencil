<script lang="ts">
import type { ComponentUI } from '@/components/ui/types'
import type { SwitchTheme } from '@/theme/switch'

export type AppSwitchUI = ComponentUI<SwitchTheme>

export interface AppSwitchProps {
  label: string
  disabled?: boolean
  size?: keyof SwitchTheme['variants']['size']
  state?: keyof SwitchTheme['variants']['state']
  ui?: AppSwitchUI
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { tv } from 'tailwind-variants'

import theme from '@/theme/switch'

const { label, disabled = false, size = 'sm', state = 'idle', ui } = defineProps<AppSwitchProps>()
const modelValue = defineModel<boolean>({ required: true })
const styles = computed(() => tv(theme)({ size, state }))
</script>

<template>
  <SwitchRoot
    v-model="modelValue"
    :aria-label="label"
    :disabled="disabled"
    :data-mixed="state === 'mixed' || undefined"
    :class="styles.root({ class: ui?.root })"
  >
    <SwitchThumb :class="styles.thumb({ class: ui?.thumb })" />
  </SwitchRoot>
</template>
