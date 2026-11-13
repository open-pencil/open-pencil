import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'

const aiToolSortSchema = v.picklist(['name', 'most-used', 'least-used'])
type AIToolSort = v.InferOutput<typeof aiToolSortSchema>

/** The last selected sort order in the AI tool access list. */
export const aiToolSort = useLocalStorage<AIToolSort>('open-pencil:ai:tool-sort', 'name', {
  flush: 'sync',
  serializer: {
    read: (raw) => {
      const result = v.safeParse(aiToolSortSchema, raw)
      return result.success ? result.output : 'name'
    },
    write: String
  }
})
