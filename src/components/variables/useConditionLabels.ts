import { computed } from 'vue'

import type { VariableCollection } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import {
  CONDITION_KINDS,
  parseModeCondition,
  type ConditionKind,
  type ModeCondition
} from '@/app/editor/tokens/conditions'
import { modeConditionPlaceholder } from '@/app/editor/tokens/model'

/** Plain-language names for mode conditions, shared by the collection inspector and the list. */
export function useConditionLabels() {
  const { variables } = useI18n()

  const kindLabels = computed<Record<ConditionKind, string>>(() => ({
    manual: variables.value.conditionManual,
    dark: variables.value.conditionDark,
    light: variables.value.conditionLight,
    contrast: variables.value.conditionContrast,
    'reduced-motion': variables.value.conditionReducedMotion,
    'screen-narrower': variables.value.conditionScreenNarrower,
    'screen-wider': variables.value.conditionScreenWider,
    'container-narrower': variables.value.conditionContainerNarrower,
    'container-wider': variables.value.conditionContainerWider,
    custom: variables.value.conditionCustom
  }))

  const kindOptions = computed(() =>
    CONDITION_KINDS.map((kind) => ({ value: kind, label: kindLabels.value[kind] }))
  )

  /**
   * One line for a column header: the preset in words, or the selector it writes. `code` marks
   * CSS, which is set in the code font, from words, which are not.
   */
  function summary(
    collection: VariableCollection,
    modeId: string
  ): { text: string; code: boolean } | undefined {
    if (modeId === collection.defaultModeId) return undefined
    const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
    const condition: ModeCondition = parseModeCondition(mode?.condition)
    if (condition.kind === 'manual')
      return { text: modeConditionPlaceholder(collection, modeId) ?? '', code: true }
    if (condition.kind === 'custom') return { text: condition.css, code: true }
    const label = kindLabels.value[condition.kind]
    return { text: 'width' in condition ? `${label} ${condition.width}px` : label, code: false }
  }

  return { kindLabels, kindOptions, summary }
}
