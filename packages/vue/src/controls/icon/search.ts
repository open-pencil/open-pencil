import { tryOnScopeDispose, watchDebounced } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import type { IconCollection } from '@open-pencil/core/icons'

import { useEditor } from '#vue/editor/context'

const SEARCH_DEBOUNCE_MS = 250
/** Hits for a search over every set; the Iconify API returns no fewer than 32. */
const SEARCH_LIMIT = 64
/** Hits for a search within one set, which a grid can show many of; the API's most. */
const SET_SEARCH_LIMIT = 999
/** Icons shown at first and added each time the list nears its end. */
const PAGE_SIZE = 96

/**
 * Searches the editor's icon provider as `query` and `set` change, keeping only the latest
 * answer. With a set chosen and no query, it lists the whole set. Previews are drawn for what is
 * shown, a page at a time.
 */
export function useIconSearch() {
  const editor = useEditor()
  const provider = () => editor.iconProvider
  const query = ref('')
  /** The set to search or browse, by prefix; null searches every set. */
  const set = ref<string | null>(null)
  /** The icon names found, or null before anything is asked. */
  const results = shallowRef<string[] | null>(null)
  /**
   * The search filled its limit, so more icons match than were returned; Iconify reports only
   * how many it returned, not how many match.
   */
  const capped = ref(false)
  const loading = ref(false)
  const failed = ref(false)
  const shown = ref(PAGE_SIZE)
  let version = 0

  const sets = shallowRef<IconCollection[]>([])
  const setsLoading = ref(false)
  /** Set names by prefix, from the catalogue and from search answers. */
  const setNames = shallowRef<ReadonlyMap<string, string>>(new Map())

  async function loadSets() {
    if (sets.value.length > 0 || setsLoading.value) return
    setsLoading.value = true
    try {
      sets.value = await provider().collections()
      setNames.value = new Map([
        ...setNames.value,
        ...sets.value.map((info) => [info.prefix, info.name] as const)
      ])
    } catch (error) {
      // Searching every set still works without the catalogue.
      console.warn('Icon sets could not be loaded', error)
    } finally {
      setsLoading.value = false
    }
  }

  // A new query or set outdates the shown icons at once, before the answer arrives.
  function invalidate() {
    version++
    shown.value = PAGE_SIZE
    failed.value = false
    loading.value = query.value.trim() !== '' || set.value !== null
    if (!loading.value) results.value = null
  }

  async function run() {
    const term = query.value.trim()
    const prefix = set.value
    if (!term && !prefix) return
    const request = version
    try {
      let names: string[]
      if (term) {
        const limit = prefix ? SET_SEARCH_LIMIT : SEARCH_LIMIT
        const found = await provider().search(term, {
          limit,
          prefix: prefix ?? undefined
        })
        if (request === version)
          setNames.value = new Map([
            ...setNames.value,
            ...Object.entries(found.collections).map(([key, info]) => [key, info.name] as const)
          ])
        names = found.icons
        if (request === version) capped.value = names.length >= limit
      } else {
        names = prefix ? await provider().browse(prefix) : []
        if (request === version) capped.value = false
      }
      if (request === version) results.value = names
    } catch {
      if (request === version) failed.value = true
    } finally {
      if (request === version) loading.value = false
    }
  }

  watch(query, invalidate, { flush: 'sync' })
  watchDebounced(query, run, { debounce: SEARCH_DEBOUNCE_MS })
  watch(set, () => {
    invalidate()
    void run()
  })
  tryOnScopeDispose(() => version++)

  const visible = computed(() => results.value?.slice(0, shown.value) ?? [])
  const hasMore = computed(() => (results.value?.length ?? 0) > shown.value)
  function loadMore() {
    if (hasMore.value) shown.value += PAGE_SIZE
  }

  // Previews are asked for in one batch per tick, so a page of icons is one request per set.
  const previews = shallowRef<ReadonlyMap<string, string>>(new Map())
  const requested = new Set<string>()
  let pending: string[] = []
  function want(names: readonly string[]) {
    for (const name of names) {
      if (requested.has(name)) continue
      requested.add(name)
      pending.push(name)
    }
    if (pending.length === 0) return
    queueMicrotask(() => void drawPending())
  }
  async function drawPending() {
    const batch = pending
    pending = []
    if (batch.length === 0) return
    try {
      const drawn = await provider().previews(batch)
      previews.value = new Map([...previews.value, ...drawn])
    } catch (error) {
      // A failed batch may be asked for again by the next page or search.
      for (const name of batch) requested.delete(name)
      console.warn('Icon previews could not be loaded', error)
    }
  }
  watch(visible, want, { immediate: true })

  /** The name of the set an icon belongs to, such as Lucide, or its prefix while unknown. */
  function setName(name: string) {
    const prefix = name.slice(0, name.indexOf(':'))
    return setNames.value.get(prefix) ?? prefix
  }

  return {
    query,
    set,
    sets,
    /** The set catalogue is on its way. */
    setsLoading,
    loadSets,
    /** The icons to show now; more follow on `loadMore` while `hasMore`. */
    visible,
    /** How many icons were found. */
    found: computed(() => results.value?.length ?? 0),
    capped,
    hasMore,
    loadMore,
    loading,
    failed,
    /** Each icon's SVG markup, once drawn; icons show before their previews arrive. */
    previews,
    /** Asks for the previews of icons shown outside the results, such as recent ones. */
    want,
    setName
  }
}
