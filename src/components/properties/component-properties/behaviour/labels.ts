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
      items: p.behaviourItems
    }
    const states: Record<InteractionState, string> = {
      rest: p.behaviourStateRest,
      hover: p.behaviourStateHover,
      pressed: p.behaviourStatePressed,
      focus: p.behaviourStateFocus,
      disabled: p.behaviourStateDisabled
    }
    return {
      state: (state: InteractionState) => states[state],
      kind: (kind: BehaviourKind) => kinds[kind],
      value: (id: string) => values[id] ?? id,
      part: (id: string) => parts[id] ?? id
    }
  })
}
