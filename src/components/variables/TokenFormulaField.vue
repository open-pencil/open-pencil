<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useSlots, useTemplateRef } from 'vue'

import inputTheme from '@/theme/input/input'
import formulaFieldTheme from '@/theme/variables/formula-field'

import type { ExpressionDialect, ReferenceCompletion } from './formula-field/dialects/types'
import type { FormulaPill, FormulaSelection } from './formula-field/source'
import { useFormulaField } from './formula-field/useFormulaField'

const model = defineModel<string>({ required: true })
const {
  dialect,
  id,
  label,
  placeholder = '',
  invalid = false,
  describedBy,
  resolve,
  completions,
  prefix,
  suffix,
  approximate = false,
  unit
} = defineProps<{
  /** The syntax the field edits; fixed for the field's lifetime. */
  dialect: ExpressionDialect
  completions: readonly ReferenceCompletion[]
  id: string
  label: string
  placeholder?: string
  invalid?: boolean
  describedBy?: string
  resolve: (source: string) => FormulaPill | undefined
  /** What the field holds, such as CSS, shown at its start. */
  prefix?: string
  /** What the formula gives, shown after its text. */
  suffix?: string
  /** Whether the result holds only where it was computed, such as for this window. */
  approximate?: boolean
  /** The unit a plain number is in, shown after it in place of a result. */
  unit?: string
}>()
const emit = defineEmits<{
  change: []
  enter: []
  cancel: []
  selection: [range: FormulaSelection]
}>()
const field = useTemplateRef<HTMLDivElement>('field')
const slots = useSlots()
const ui = tv(formulaFieldTheme)()
const inputUI = tv(inputTheme)

const editing = useFormulaField(field, model, {
  dialect,
  label: () => label,
  placeholder: () => placeholder,
  completions: () => completions,
  attributes: () => ({
    id,
    'aria-invalid': String(invalid),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    'aria-multiline': 'true'
  }),
  resolve: (source) => resolve(source),
  result: () => (suffix ? `${approximate ? '≈' : '='} ${suffix}` : unit),
  buttons: () => Boolean(slots.actions),
  onChange: () => emit('change'),
  onEnter: () => emit('enter'),
  onCancel: () => emit('cancel'),
  onSelection: (range) => emit('selection', range)
})

defineExpose({
  focus: editing.focus,
  blur: editing.blur,
  setSelectionRange: editing.setSelectionRange
})
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div
    :class="[inputUI({ size: 'sm' }), ui.root()]"
    :data-invalid="invalid ? '' : undefined"
    @pointerdown.self.prevent="editing.focus()"
  >
    <span v-if="prefix" :class="ui.prefix()" aria-hidden="true">{{ prefix }}</span>
    <div ref="field" :class="ui.editor()" />
    <span v-if="$slots.actions" :class="ui.actions()">
      <slot name="actions" />
    </span>
  </div>
</template>
