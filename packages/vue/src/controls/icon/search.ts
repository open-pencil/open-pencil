import { tryOnScopeDispose, watchDebounced } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import type { IconSearchResult } from '@open-pencil/core/icons'

import { useEditor } from '#vue/editor/context'

const SEARCH_DEBOUNCE_MS = 250
/** The Iconify API returns no fewer than 32 results. */
const SEARCH_LIMIT = 64

export interface IconSearchHit {
  /** `prefix:name`. */
  name: string
  /** The set the icon belongs to, such as Lucide. */
  collection: string
}

/**
 * Searches the editor's icon provider as `query` changes, keeping only the latest answer, and
 * draws each hit's preview.
 */
export function useIconSearch() {
  const editor = useEditor()
  const query = ref('')
  const result = shallowRef<IconSearchResult | null>(null)
  const previews = shallowRef<ReadonlyMap<string, string>>(new Map())
  const loading = ref(false)
  const failed = ref(false)
  let version = 0

  // A new query outdates the shown hits at once, before the debounced search answers.
  watch(query, (value) => {
    version++
    loading.value = value.trim() !== ''
    failed.value = false
    if (!loading.value) {
      result.value = null
      previews.value = new Map()
    }
  })

  watchDebounced(
    query,
    async (value) => {
      const term = value.trim()
      if (!term) return
      const request = version
      try {
        const found = await editor.iconProvider.search(term, { limit: SEARCH_LIMIT })
        if (request !== version) return
        result.value = found
        // One request per icon set draws every hit, rather than one image request per icon.
        const drawn = await editor.iconProvider.previews(found.icons)
        if (request === version) previews.value = drawn
      } catch {
        if (request === version) failed.value = true
      } finally {
        if (request === version) loading.value = false
      }
    },
    { debounce: SEARCH_DEBOUNCE_MS }
  )
  tryOnScopeDispose(() => version++)

  const hits = computed<IconSearchHit[]>(() =>
    (result.value?.icons ?? []).map((name) => {
      const prefix = name.slice(0, name.indexOf(':'))
      return { name, collection: result.value?.collections[prefix]?.name ?? prefix }
    })
  )

  return {
    query,
    hits,
    loading,
    failed,
    /** Each hit's SVG markup, once drawn; hits show before their previews arrive. */
    previews
  }
}
