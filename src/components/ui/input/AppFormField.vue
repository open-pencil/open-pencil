<script setup lang="ts">
import { computed, normalizeClass, useId, type HTMLAttributes } from 'vue'

import { formField, type FormFieldUI } from './form-field'

/**
 * A labelled control with its error, or else its hint, underneath. The control comes in the
 * default slot, which receives the id the label points at, the label's own id for a group named by
 * `aria-labelledby`, whether the field is invalid, and the id of the line that describes it.
 */
const {
  label,
  id: givenId,
  error = null,
  hint,
  size = 'md',
  labelHidden = false,
  labelFor = true,
  class: className,
  ui
} = defineProps<{
  label: string
  id?: string
  error?: string | null
  hint?: string
  size?: 'md' | 'lg'
  /** Shown only to screen readers, for a control whose placeholder already says what it is. */
  labelHidden?: boolean
  /** False for a control that a `<label for>` can't name, such as a radio group or a select. */
  labelFor?: boolean
  class?: HTMLAttributes['class']
  ui?: FormFieldUI
}>()

const generatedId = useId()
const id = computed(() => givenId ?? generatedId)
const cls = computed(() => {
  const field = formField({ size })
  return {
    root: field.root({ class: [ui?.root, normalizeClass(className)] }),
    labelRow: field.labelRow({ class: ui?.labelRow }),
    label: field.label({ class: ui?.label }),
    hint: field.hint({ class: ui?.hint }),
    error: field.error({ class: ui?.error })
  }
})
const describedBy = computed(() => {
  if (error) return `${id.value}-error`
  return hint ? `${id.value}-hint` : undefined
})
</script>

<template>
  <div :class="cls.root">
    <div v-if="$slots['label-actions']" :class="cls.labelRow">
      <component
        :is="labelFor ? 'label' : 'span'"
        :id="`${id}-label`"
        :for="labelFor ? id : undefined"
        :data-hidden="labelHidden"
        :class="cls.label"
        >{{ label }}</component
      >
      <slot name="label-actions" />
    </div>
    <component
      :is="labelFor ? 'label' : 'span'"
      v-else
      :id="`${id}-label`"
      :for="labelFor ? id : undefined"
      :data-hidden="labelHidden"
      :class="cls.label"
      >{{ label }}</component
    >
    <slot :id="id" :labelId="`${id}-label`" :invalid="Boolean(error)" :describedBy="describedBy" />
    <p v-if="error" :id="`${id}-error`" :class="cls.error">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" :class="cls.hint">{{ hint }}</p>
  </div>
</template>
