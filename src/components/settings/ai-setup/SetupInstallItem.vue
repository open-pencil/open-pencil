<script setup lang="ts">
import { tv } from 'tailwind-variants'

import AppButton from '@/components/ui/button/AppButton.vue'
import theme from '@/theme/settings/ai-setup/flow'

/** One thing guided setup checks on this computer, with an optional one-click fix. */
const {
  ready,
  action,
  loading = false,
  disabled = false
} = defineProps<{
  /** Installed and usable as it is. */
  ready: boolean
  /** Label of the button that installs or updates it; no button when absent. */
  action?: string
  loading?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ action: [] }>()
const styles = tv(theme)()
</script>

<template>
  <li :class="styles.installItem()" :data-status="ready ? 'available' : 'missing'">
    <icon-lucide-circle-check v-if="ready" :class="styles.signedInIcon()" aria-hidden="true" />
    <icon-lucide-circle-dashed v-else :class="styles.missingIcon()" aria-hidden="true" />
    <span class="flex-1"><slot /></span>
    <slot name="action">
      <AppButton
        v-if="action"
        size="xs"
        variant="outline"
        :disabled="disabled"
        :loading="loading"
        @click="emit('action')"
      >
        {{ action }}
      </AppButton>
    </slot>
  </li>
</template>
