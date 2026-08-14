<script setup lang="ts">
import AppTextButton from '@/components/ui/AppTextButton.vue'

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
      <AppTextButton v-if="clearLabel" v-bind="$attrs" @click="emit('clear')">
        {{ clearLabel }}
      </AppTextButton>
    </div>
    <slot />
    <slot name="hint" />
  </div>
</template>
