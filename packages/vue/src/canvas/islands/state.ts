import { reactive } from 'vue'

import type { InstanceState } from '@open-pencil/core/editor'
import { numberSettings, type InteractionState } from '@open-pencil/scene-graph'

import { booleanOf, type ControlModel } from './model'

/** What one control of an island holds while it runs. */
export interface ControlState {
  booleans: Partial<Record<string, boolean>>
  /** The chosen tab, radio, toggle, or accordion item, as its index; '' when none is. */
  choice: string
  number: number
  texts: Partial<Record<string, string>>
  hovered: boolean
  pressed: boolean
  /** Whether the control shows focus: from the keyboard, or always for a text field. */
  focused: boolean
}

const TEXT_INPUTS = new Set(['textField', 'textarea', 'numberField'])

function initialChoice(control: ControlModel): string {
  if (control.kind === 'tabs') return '0'
  const index = control.items.findIndex((item) => {
    const value = booleanOf(item, 'value') ?? booleanOf(item, 'open')
    return value?.designed ?? false
  })
  if (index !== -1) return String(index)
  // A radio group always has one radio on; other groups may have none.
  return control.kind === 'radioGroup' ? '0' : ''
}

function initialTexts(control: ControlModel): Record<string, string> {
  const filled = booleanOf(control, 'filled')
  const placeholder = !!filled && !filled.designed
  return Object.fromEntries(
    Object.entries(control.texts).map(([valueId, text]) => [
      valueId,
      placeholder ? '' : text.designed
    ])
  )
}

/** The island's controls as they start: each as its instance is drawn. */
export function createIslandState(controls: ReadonlyMap<string, ControlModel>) {
  return reactive(
    new Map(
      [...controls.values()].map((control): [string, ControlState] => [
        control.path,
        {
          booleans: Object.fromEntries(
            Object.entries(control.booleans).map(([valueId, model]) => [valueId, model.designed])
          ),
          choice: initialChoice(control),
          number: numberSettings(control.behaviour, 'value')?.default ?? 0,
          texts: initialTexts(control),
          hovered: false,
          pressed: false,
          focused: false
        }
      ])
    )
  )
}

export type IslandState = ReturnType<typeof createIslandState>

/** Whether a control is disabled: its disabled value is on, or it is drawn disabled. */
export function isDisabled(control: ControlModel, state: ControlState | undefined): boolean {
  return !!state?.booleans.disabled || !!control.states?.designedDisabled
}

function interactionState(control: ControlModel, state: ControlState): InteractionState {
  if (isDisabled(control, state)) return 'disabled'
  if (state.pressed) return 'pressed'
  if (state.hovered) return 'hover'
  if (state.focused) return 'focus'
  return 'rest'
}

/** The text field's Filled value follows whether it holds text. */
function filled(control: ControlModel, state: ControlState): ControlState['booleans'] {
  if (!TEXT_INPUTS.has(control.kind) || !booleanOf(control, 'filled')) return state.booleans
  return { ...state.booleans, filled: (state.texts.value ?? '') !== '' }
}

function instanceState(control: ControlModel, state: ControlState): InstanceState {
  const variants: Record<string, string> = {}
  const properties: Record<string, string> = {}
  for (const [valueId, on] of Object.entries(filled(control, state))) {
    const model = booleanOf(control, valueId)
    if (!model || on === undefined) continue
    if (model.definition.type === 'BOOLEAN') properties[model.definition.id] = String(on)
    else {
      const value = on ? model.on : model.off
      if (value) variants[model.definition.name] = value
    }
  }
  const prefer: Record<string, string> = {}
  if (control.states) {
    const value = control.states.values[interactionState(control, state)] ?? control.states.rest
    if (value) prefer[control.states.name] = value
  }
  return { variants, prefer, properties, reveal: control.reveal }
}

/** How each instance of the island is shown, by layer path, for `resolvePlayState`. */
export function instanceStates(
  controls: ReadonlyMap<string, ControlModel>,
  state: IslandState
): Map<string, InstanceState> {
  const states = new Map<string, InstanceState>()
  for (const control of controls.values()) {
    const current = state.get(control.path)
    if (current) states.set(control.path, instanceState(control, current))
  }
  return states
}
