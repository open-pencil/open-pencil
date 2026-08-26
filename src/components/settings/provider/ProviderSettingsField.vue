<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'

interface ProviderSettingsFieldProps {
  label: string
  labelFor?: string
  clearLabel?: string
}

defineOptions({ inheritAttrs: false })

const { label, labelFor, clearLabel } = defineProps<ProviderSettingsFieldProps>()

const emit = defineEmits<{ clear: [] }>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <label :for="labelFor" class="text-[10px] text-muted">{{ label }}</label>
      <AppButton
        v-if="clearLabel"
        color="neutral"
        variant="link"
        size="xs"
        v-bind="$attrs"
        @click="emit('clear')"
      >
        {{ clearLabel }}
      </AppButton>
    </div>
    <slot />
    <slot name="hint" />
  </div>
</template>
