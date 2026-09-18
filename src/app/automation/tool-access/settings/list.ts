import { computed, ref, watch, type Ref } from 'vue'

import type { ToolAccessEntry } from '../types'

/** Tool access is derived from the catalog and one controlled disabled-name model. */
export function useToolAccess(tools: Readonly<Ref<ToolAccessEntry[]>>, disabled: Ref<string[]>) {
  const search = ref('')
  const disabledNames = computed(() => new Set(disabled.value))
  const enabledCount = computed(() => tools.value.filter(isEnabled).length)
  const visibleTools = computed(() => {
    const query = search.value.trim().toLowerCase()
    return tools.value.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) || tool.description.toLowerCase().includes(query)
    )
  })

  function isEnabled(tool: ToolAccessEntry) {
    return !disabledNames.value.has(tool.name)
  }

  function setEnabled(names: string[], enabled: boolean) {
    const next = new Set(disabled.value)
    for (const name of names) {
      if (enabled) next.delete(name)
      else next.add(name)
    }
    disabled.value = [...next]
  }

  function category(effect: ToolAccessEntry['effect']) {
    const members = computed(() => tools.value.filter((tool) => tool.effect === effect))
    const count = computed(() => members.value.filter(isEnabled).length)
    return {
      enabled: computed({
        get: () => count.value > 0,
        set: (enabled: boolean) =>
          setEnabled(
            members.value.map((tool) => tool.name),
            enabled
          )
      }),
      state: computed<'mixed' | 'idle'>(() =>
        count.value > 0 && count.value < members.value.length ? 'mixed' : 'idle'
      )
    }
  }

  const inspection = category('read')
  const modification = category('write')
  const expanded = ref({ read: true, write: true })
  watch(search, () => {
    expanded.value = { read: true, write: true }
  })
  const categories = { read: inspection, write: modification }
  const groups = computed(() =>
    (['read', 'write'] as const).map((effect) => ({
      effect,
      enabled: categories[effect].enabled.value,
      state: categories[effect].state.value,
      tools: visibleTools.value.filter((tool) => tool.effect === effect)
    }))
  )

  return {
    search,
    visibleTools,
    enabledCount,
    groups,
    expanded,
    inspectionEnabled: inspection.enabled,
    inspectionState: inspection.state,
    modificationEnabled: modification.enabled,
    modificationState: modification.state,
    setGroupEnabled: (effect: ToolAccessEntry['effect'], enabled: boolean) => {
      categories[effect].enabled.value = enabled
    },
    isEnabled,
    setToolEnabled: (name: string, enabled: boolean) => setEnabled([name], enabled)
  }
}
