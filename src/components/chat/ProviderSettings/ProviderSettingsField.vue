<script setup lang="ts">
import AppTextButton from '@/components/ui/AppTextButton.vue'
import type { TestIdProps } from '@inkly/vue'

interface ProviderSettingsFieldProps extends TestIdProps {
  label: string
  clearLabel?: string
}

const { label, clearLabel, testId } = defineProps<ProviderSettingsFieldProps>()

const emit = defineEmits<{ clear: [] }>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <label class="text-[10px] text-muted">{{ label }}</label>
      <AppTextButton v-if="clearLabel" :test-id="testId" @click="emit('clear')">
        {{ clearLabel }}
      </AppTextButton>
    </div>
    <slot />
    <slot name="hint" />
  </div>
</template>
