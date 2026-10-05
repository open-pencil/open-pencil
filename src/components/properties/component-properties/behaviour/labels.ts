import { computed } from 'vue'

import type { BehaviourKind, InteractionState } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

/** Translated names of behaviour kinds, values, parts, and interaction states. */
export function useBehaviourLabels() {
  const { panels } = useI18n()
  return computed(() => {
    const p = panels.value
    const kinds: Record<BehaviourKind, { label: string; description: string }> = {
      button: { label: p.behaviourButton, description: p.behaviourButtonDescription },
      textField: { label: p.behaviourTextField, description: p.behaviourTextFieldDescription },
      textarea: { label: p.behaviourTextarea, description: p.behaviourTextareaDescription },
      numberField: {
        label: p.behaviourNumberField,
        description: p.behaviourNumberFieldDescription
      },
      toggle: { label: p.behaviourToggle, description: p.behaviourToggleDescription },
      switch: { label: p.behaviourSwitch, description: p.behaviourSwitchDescription },
      checkbox: { label: p.behaviourCheckbox, description: p.behaviourCheckboxDescription },
      radio: { label: p.behaviourRadio, description: p.behaviourRadioDescription },
      radioGroup: { label: p.behaviourRadioGroup, description: p.behaviourRadioGroupDescription },
      toggleGroup: {
        label: p.behaviourToggleGroup,
        description: p.behaviourToggleGroupDescription
      },
      slider: { label: p.behaviourSlider, description: p.behaviourSliderDescription },
      progress: { label: p.behaviourProgress, description: p.behaviourProgressDescription },
      tabs: { label: p.behaviourTabs, description: p.behaviourTabsDescription },
      collapsible: {
        label: p.behaviourCollapsible,
        description: p.behaviourCollapsibleDescription
      },
      accordion: { label: p.behaviourAccordion, description: p.behaviourAccordionDescription }
    }
    const values: Record<string, string> = {
      value: p.behaviourValue,
      open: p.behaviourOpen,
      filled: p.behaviourFilled,
      text: p.behaviourText,
      disabled: p.behaviourDisabled
    }
    const parts: Record<string, string> = {
      track: p.behaviourTrack,
      thumb: p.behaviourThumb,
      range: p.behaviourRange,
      indicator: p.behaviourIndicator,
      list: p.behaviourList,
      trigger: p.behaviourTrigger,
      content: p.behaviourContent,
      panels: p.behaviourPanels,
      items: p.behaviourItems,
      increment: p.behaviourIncrement,
      decrement: p.behaviourDecrement
    }
    const states: Record<InteractionState, string> = {
      rest: p.behaviourStateRest,
      hover: p.behaviourStateHover,
      pressed: p.behaviourStatePressed,
      focus: p.behaviourStateFocus,
      disabled: p.behaviourStateDisabled
    }
    /** What a control's main value is called, which code calls its `value`. */
    const mainValue: Partial<Record<BehaviourKind, string>> = {
      switch: p.behaviourOnValue,
      checkbox: p.behaviourChecked,
      radio: p.behaviourChecked,
      toggle: p.behaviourPressed,
      textField: p.behaviourText,
      textarea: p.behaviourText
    }
    return {
      state: (state: InteractionState) => states[state],
      /** A value's name for this kind of control. */
      valueOf: (kind: BehaviourKind, id: string) =>
        (id === 'value' ? mainValue[kind] : undefined) ??
        (Object.hasOwn(values, id) ? values[id] : id),
      kind: (kind: BehaviourKind) => kinds[kind],
      part: (id: string) => parts[id] ?? id
    }
  })
}
