<script lang="ts">
import type { HTMLAttributes } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import type { PresetNumberTheme } from '@/theme/input/preset-number'

export type PresetNumberUI = ComponentUI<PresetNumberTheme> & {
  /** Width overrides forwarded to the child controls. */
  select?: string
  field?: string
}

/** Sentinel option value; never a real number so it cannot collide with a preset. */
const CUSTOM_OPTION = 'custom'

export interface PresetNumberFieldProps {
  /** Values offered directly; the current value selects one of them when it matches. */
  presets: readonly number[]
  min: number
  max: number
  /** Accessible name shared by the preset select and the custom field. */
  label: string
  /** Translated label for the escape-hatch option. */
  customLabel: string
  /** Translated message shown when a custom value is outside the range. */
  rangeMessage: string
  disabled?: boolean
  class?: HTMLAttributes['class']
  ui?: PresetNumberUI
}
</script>

<script setup lang="ts">
import { computed, nextTick, normalizeClass, ref, useId, useTemplateRef, watch } from 'vue'

import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { presetNumber, presetNumberSizes } from '@/theme/input/preset-number'

const {
  presets,
  min,
  max,
  label,
  customLabel,
  rangeMessage,
  disabled = false,
  ui,
  class: className
} = defineProps<PresetNumberFieldProps>()

const emit = defineEmits<{ commit: [value: number] }>()
defineOptions({ inheritAttrs: false })

const errorID = `${useId()}-range`

const value = defineModel<number>('number', { required: true })
const styles = computed(() => presetNumber())
const custom = ref(!presets.includes(value.value))
const draft = ref(String(value.value))
const invalid = ref(false)
const field = useTemplateRef<{ focus: (options?: FocusOptions) => void }>('field')

const selection = computed({
  get: () => (custom.value ? CUSTOM_OPTION : String(value.value)),
  set: (next: string) => {
    if (next === CUSTOM_OPTION) {
      custom.value = true
      invalid.value = false
      draft.value = String(value.value)
      void nextTick(() => field.value?.focus())
      return
    }
    const parsed = Number(next)
    if (!Number.isFinite(parsed)) return
    custom.value = false
    invalid.value = false
    value.value = parsed
    emit('commit', parsed)
  }
})

const options = computed(() => [
  ...presets.map((preset) => ({ value: String(preset), label: String(preset) })),
  { value: CUSTOM_OPTION, label: customLabel }
])

/** Selecting a preset again, or a value arriving from elsewhere, exits custom mode. */
watch(value, (next) => {
  // Follow the model in both directions: a non-preset value arriving from the
  // owner must reveal the field instead of leaving the select without a match.
  custom.value = !presets.includes(next)
  invalid.value = false
  draft.value = String(next)
})

function commitDraft(): void {
  const parsed = Number(draft.value)
  const valid = Number.isInteger(parsed) && parsed >= min && parsed <= max
  invalid.value = !valid
  if (!valid || parsed === value.value) return
  value.value = parsed
  emit('commit', parsed)
}
</script>

<template>
  <div
    v-bind="$attrs"
    :class="styles.root({ class: [ui?.root, normalizeClass(className)] })"
    data-slot="root"
  >
    <div :class="styles.row({ class: ui?.row })">
      <AppSelect
        v-model="selection"
        :options="options"
        :label="label"
        :disabled="disabled"
        :ui="{ trigger: ui?.select ?? presetNumberSizes.select }"
      />
      <AppInput
        v-if="custom"
        ref="field"
        v-model="draft"
        type="number"
        :min="min"
        :max="max"
        :step="1"
        :disabled="disabled"
        :aria-label="`${label}: ${customLabel}`"
        :aria-invalid="invalid"
        :aria-describedby="invalid ? errorID : undefined"
        :state="invalid ? 'invalid' : 'idle'"
        :class="ui?.field ?? presetNumberSizes.field"
        @enter="commitDraft"
        @blur="commitDraft"
      />
    </div>
    <p v-if="invalid" :id="errorID" :class="styles.error({ class: ui?.error })" role="alert">
      {{ rangeMessage }}
    </p>
  </div>
</template>
