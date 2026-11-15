import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'
import { computed } from 'vue'

import { configurableAITools, isAIToolEnabled } from './catalog'

const overridesSchema = v.pipe(v.string(), v.parseJson(), v.record(v.string(), v.boolean()))

export const aiToolOverrides = useLocalStorage<Record<string, boolean>>(
  'open-pencil:ai:tool-access',
  {},
  {
    serializer: {
      read: (raw) => {
        const result = v.safeParse(overridesSchema, raw)
        return result.success ? result.output : {}
      },
      write: JSON.stringify
    }
  }
)

function disabledWith(overrides: Readonly<Record<string, boolean>>): string[] {
  return configurableAITools
    .filter((tool) => !isAIToolEnabled(tool.name, overrides))
    .map((tool) => tool.name)
}

/** The AI tools that are off when nothing has been changed. */
export function defaultDisabledAITools(): string[] {
  return disabledWith({})
}

export const disabledAITools = computed({
  get: () => disabledWith(aiToolOverrides.value),
  set: (names: string[]) => {
    const disabled = new Set(names)
    aiToolOverrides.value = Object.fromEntries(
      configurableAITools.map((tool) => [tool.name, !disabled.has(tool.name)])
    )
  }
})
