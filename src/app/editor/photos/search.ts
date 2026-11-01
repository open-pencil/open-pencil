import { useLocalStorage, watchDebounced } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import { getStockPhotoProvider, type StockPhotoResult } from '@open-pencil/core/tools'

import { pexelsKeyStatus, unsplashKeyStatus } from '@/app/settings/credentials/media'

export type PhotoService = 'unsplash' | 'pexels'

/** The services, with where to get a key and the site the picker credits, as both ask. */
export const PHOTO_SERVICES: readonly {
  id: PhotoService
  name: string
  keyURL: string
  siteURL: string
}[] = [
  {
    id: 'unsplash',
    name: 'Unsplash',
    keyURL: 'https://unsplash.com/oauth/applications',
    siteURL: 'https://unsplash.com/?utm_source=openpencil&utm_medium=referral'
  },
  {
    id: 'pexels',
    name: 'Pexels',
    keyURL: 'https://www.pexels.com/api/',
    siteURL: 'https://www.pexels.com'
  }
]

const PHOTO_SERVICE_STORAGE_KEY = 'open-pencil:photo-service'
/** Results a page; a multiple of the picker's three columns. */
const PHOTOS_PER_PAGE = 24
/** The width a placed photo is downloaded at; the services' regular size. */
export const PLACED_PHOTO_SIZE = 1080
const SEARCH_DEBOUNCE_MS = 300

/** The service the picker searched last. */
export const lastPhotoService = useLocalStorage<PhotoService>(PHOTO_SERVICE_STORAGE_KEY, 'unsplash')

export function photoServiceHasKey(service: PhotoService): boolean {
  const status = service === 'pexels' ? pexelsKeyStatus.value : unsplashKeyStatus.value
  return status === 'configured'
}

/**
 * Searches the chosen stock photo service as the query changes, a page at a time, and shows its
 * own picks (Unsplash's editorial feed, Pexels' curated photos) while the query is empty. A newer
 * request drops the answers to older ones.
 */
export function usePhotoSearch() {
  const query = ref('')
  const service = lastPhotoService
  const photos = shallowRef<StockPhotoResult[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const hasMore = ref(false)
  const hasKey = computed(() => photoServiceHasKey(service.value))
  let page = 0
  let generation = 0
  /**
   * The picks last listed, kept so clearing a search shows them again without another request:
   * a new Unsplash key has 50 requests an hour.
   */
  let picks: {
    service: PhotoService
    photos: StockPhotoResult[]
    page: number
    hasMore: boolean
  } | null = null

  function show(found: StockPhotoResult[], next: number, more: boolean) {
    page = next
    const shown = next === 1 ? [] : photos.value
    const seen = new Set(shown.map((photo) => photo.sourceId))
    photos.value = [...shown, ...found.filter((photo) => !seen.has(photo.sourceId))]
    hasMore.value = more
  }

  async function load(next: number) {
    const term = query.value.trim()
    const provider = getStockPhotoProvider(service.value)
    const current = ++generation
    if (!provider || (!term && !provider.browse)) {
      photos.value = []
      loading.value = false
      failed.value = false
      hasMore.value = false
      return
    }
    if (!term && next === 1 && picks?.service === service.value) {
      photos.value = picks.photos
      page = picks.page
      hasMore.value = picks.hasMore
      loading.value = false
      failed.value = false
      return
    }
    loading.value = true
    failed.value = false
    const options = { perPage: PHOTOS_PER_PAGE, page: next, targetDim: PLACED_PHOTO_SIZE }
    try {
      const found = term
        ? await provider.search(term, options)
        : ((await provider.browse?.(options)) ?? [])
      if (current !== generation) return
      show(found, next, found.length === PHOTOS_PER_PAGE)
      if (!term) {
        picks = { service: service.value, photos: photos.value, page, hasMore: hasMore.value }
      }
    } catch {
      if (current !== generation) return
      failed.value = true
      hasMore.value = false
    } finally {
      if (current === generation) loading.value = false
    }
  }

  // Another service's photos must not stay pickable while the new search waits out the
  // debounce: they would be placed and reported as the new service's.
  watch(service, () => {
    generation++
    photos.value = []
    hasMore.value = false
    failed.value = false
  })
  // Placeholders show from the first keystroke, not only once the search goes out.
  watch([query, service], () => {
    if (hasKey.value) loading.value = true
  })
  watchDebounced([query, service, hasKey], () => void load(1), { debounce: SEARCH_DEBOUNCE_MS })

  /**
   * Readies the picker as it opens: on the service last searched, or on one with a key when that
   * one has none, showing its picks unless photos are already listed.
   */
  function open() {
    if (!hasKey.value) {
      const configured = PHOTO_SERVICES.find((item) => photoServiceHasKey(item.id))
      if (configured) service.value = configured.id
    }
    if (photos.value.length === 0 && !loading.value) void load(1)
  }

  function loadMore() {
    if (!loading.value && hasMore.value) void load(page + 1)
  }

  function find(id: string) {
    return photos.value.find((photo) => photo.sourceId === id)
  }

  return { query, service, photos, loading, failed, hasMore, hasKey, open, loadMore, find }
}
