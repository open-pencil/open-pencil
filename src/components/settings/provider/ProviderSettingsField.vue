<script setup lang="ts">
import { compact } from 'es-toolkit/array'
import { computed, useId } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'

interface ProviderSettingsFieldProps {
  label: string
  labelFor?: string
  clearLabel?: string
  hint?: string
  error?: string
}

defineOptions({ inheritAttrs: false })

const { label, labelFor, clearLabel, hint, error } = defineProps<ProviderSettingsFieldProps>()
const generatedID = useId()
const inputID = computed(() => labelFor || generatedID)
const control = computed(() => ({
  id: inputID.value,
  'aria-invalid': Boolean(error),
  'aria-describedby':
    compact([error && `${inputID.value}-error`, hint && `${inputID.value}-hint`]).join(' ') ||
    undefined,
  state: error ? ('invalid' as const) : ('idle' as const)
}))

const emit = defineEmits<{ clear: []; blur: [] }>()
</script>

<template>
  <div class="flex flex-col gap-1" @focusout="emit('blur')">
    <div class="flex items-center justify-between">
      <label :for="inputID" class="text-xs text-surface">{{ label }}</label>
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
    <slot :control="control" />
    <p v-if="error" :id="`${inputID}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-if="hint" :id="`${inputID}-hint`" class="text-[11px] leading-relaxed text-muted">
      {{ hint }}
    </p>
    <slot name="hint" />
  </div>
</template>
