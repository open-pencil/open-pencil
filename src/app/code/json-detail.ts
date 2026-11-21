import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

/** Everything the document knows about the selection, or its structure in brief. */
export const JSON_DETAILS = ['full', 'compact'] as const
export type JSONDetail = (typeof JSON_DETAILS)[number]

const stored = useLocalStorage<string>('open-pencil:code-json-detail', 'full')

export function isJSONDetail(value: string): value is JSONDetail {
  return JSON_DETAILS.some((detail) => detail === value)
}

/** How much the Code tab's JSON shows, remembered across sessions. */
export const codeJSONDetail = computed<JSONDetail>({
  get: () => (isJSONDetail(stored.value) ? stored.value : 'full'),
  set: (value) => {
    stored.value = value
  }
})
