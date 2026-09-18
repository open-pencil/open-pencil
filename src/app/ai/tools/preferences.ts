import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'
import { computed } from 'vue'

import { configurableAITools, isAIToolEnabled } from './catalog'

const overridesSchema = v.record(v.string(), v.boolean())

export const aiToolOverrides = useLocalStorage<Record<string, boolean>>(
  'open-pencil:ai:tool-access',
  {},
  {
    serializer: {
      read: (raw) => {
        try {
          const result = v.safeParse(overridesSchema, JSON.parse(raw))
          return result.success ? result.output : {}
        } catch {
          return {}
        }
      },
      write: JSON.stringify
    }
  }
)

export const disabledAITools = computed({
  get: () =>
    configurableAITools
      .filter((tool) => !isAIToolEnabled(tool.name, aiToolOverrides.value))
      .map((tool) => tool.name),
  set: (names: string[]) => {
    const disabled = new Set(names)
    aiToolOverrides.value = Object.fromEntries(
      configurableAITools.map((tool) => [tool.name, !disabled.has(tool.name)])
    )
  }
})
