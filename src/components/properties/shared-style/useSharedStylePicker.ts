import { computed } from 'vue'

import type { SharedStyleKind } from '@open-pencil/scene-graph'
import { MIXED, useI18n, useSharedStyleBinding } from '@open-pencil/vue'

export function useSharedStylePicker(kind: SharedStyleKind) {
  const { panels } = useI18n()
  const binding = useSharedStyleBinding(kind)
  const { active, styleId, styles } = binding
  const visible = computed(
    () => active.value && (styles.value.length > 0 || styleId.value !== null)
  )
  const hasStyle = computed(() => styleId.value !== null)
  const value = computed(() => (styleId.value === MIXED ? 'MIXED' : (styleId.value ?? 'NONE')))
  const options = computed(() => {
    const result: Array<{ value: string; label: string }> = [
      { value: 'NONE', label: panels.value.none }
    ]
    if (styleId.value === MIXED) result.unshift({ value: 'MIXED', label: panels.value.mixed })
    for (const style of styles.value) result.push({ value: style.id, label: style.name })
    if (
      typeof styleId.value === 'string' &&
      !styles.value.some((style) => style.id === styleId.value)
    ) {
      result.push({ value: styleId.value, label: panels.value.missingStyle({ id: styleId.value }) })
    }
    return result
  })
  function update(next: string) {
    if (next === 'MIXED') return
    if (next === 'NONE') binding.unbind()
    else binding.bind(next)
  }
  return { visible, hasStyle, value, options, update }
}
