import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot
} from 'reka-ui'
import { h, type VNode } from 'vue'

import { booleanOf, type ControlModel, type ControlRole } from '@open-pencil/dom-css/export'
import { numberSettings } from '@open-pencil/scene-graph'

import type { ElementOverride, IslandRenderContext } from '#vue/canvas/islands/render'

import { disabled, interaction, stateOf } from './shared'

type Base = (override?: ElementOverride) => VNode

/** A text layer's look carried over to the input that replaces it. */
const INPUT_RESET: Record<string, string> = {
  border: 'none',
  outline: 'none',
  padding: '0',
  margin: '0',
  background: 'transparent',
  resize: 'none',
  'box-sizing': 'border-box'
}

/** A text field, textarea, or number field: its root shows focus and drives its look. */
export function fieldRoot(island: IslandRenderContext, control: ControlModel, base: Base): VNode {
  const state = stateOf(island, control)
  const props = interaction(state, true)
  if (control.kind !== 'numberField') return base({ props })
  const settings = numberSettings(control.behaviour, 'value')
  return h(
    NumberFieldRoot,
    {
      asChild: true,
      modelValue: state.number,
      'onUpdate:modelValue': (value: number) => {
        if (Number.isFinite(value)) state.number = value
      },
      min: settings?.min,
      max: settings?.max,
      step: settings?.step,
      disabled: disabled(island, control)
    },
    { default: () => base({ props }) }
  )
}

/** The text layer of a field, as the input it is, or a number field's stepper part. */
export function fieldRole(
  island: IslandRenderContext,
  role: ControlRole,
  base: Base
): VNode | undefined {
  if (role.type === 'part' && role.control.kind === 'numberField') {
    const stepper = role.part === 'increment' ? NumberFieldIncrement : NumberFieldDecrement
    return h(
      stepper,
      { asChild: true },
      { default: () => base({ tag: 'button', props: { type: 'button' } }) }
    )
  }
  if (role.type !== 'text') return undefined
  const { control, valueId } = role
  const state = stateOf(island, control)
  const off = disabled(island, control)
  if (control.kind === 'numberField')
    return h(
      NumberFieldInput,
      { asChild: true },
      {
        default: () =>
          base({ tag: 'input', style: INPUT_RESET, props: { disabled: off }, children: () => [] })
      }
    )
  const text = Object.hasOwn(control.texts, valueId) ? control.texts[valueId] : undefined
  const placeholder = booleanOf(control, 'filled') ? text?.designed : undefined
  return base({
    tag: control.kind === 'textarea' ? 'textarea' : 'input',
    style: INPUT_RESET,
    props: {
      value: state.texts[valueId] ?? '',
      placeholder,
      disabled: off,
      onInput: (event: Event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
          state.texts[valueId] = event.target.value
      }
    },
    children: () => []
  })
}
