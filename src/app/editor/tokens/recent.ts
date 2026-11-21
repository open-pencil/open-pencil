import { useLocalStorage } from '@vueuse/core'
import { uniq } from 'es-toolkit/array'
import * as v from 'valibot'
import { readonly } from 'vue'

/** How many variables the pickers keep as recent. */
const RECENT_VARIABLE_LIMIT = 8

const recentSchema = v.pipe(v.string(), v.parseJson(), v.array(v.string()))

const recent = useLocalStorage<string[]>('open-pencil:recent-variables', [], {
  serializer: {
    read: (raw) => {
      const result = v.safeParse(recentSchema, raw)
      return result.success ? result.output : []
    },
    write: JSON.stringify
  }
})

/**
 * The variables applied last, newest first, by ID. A document's variables have IDs of their
 * own, so pickers show only those the open document has.
 */
export const recentVariableIds = readonly(recent)

/** Puts a variable first among the recent ones. */
export function rememberRecentVariable(id: string) {
  recent.value = uniq([id, ...recent.value]).slice(0, RECENT_VARIABLE_LIMIT)
}
