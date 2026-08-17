import { useEventListener, useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, readonly, ref, shallowRef, type Ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import { createDocumentPreviews } from './previews'

export type DocumentWorkspaceItem = {
  id: string
  name: string
  updatedAt: string
}

export interface DocumentWorkspaceSource<Item extends DocumentWorkspaceItem> {
  refresh(): Promise<Item[] | null>
  loadPreview(id: string): Promise<Uint8Array | null>
  subscribe?(listener: () => void): () => void
}

export type UseDocumentWorkspaceOptions<Item extends DocumentWorkspaceItem> = {
  source: DocumentWorkspaceSource<Item>
  refreshInterval?: number
  refreshOnFocus?: boolean
  refreshOnReconnect?: boolean
  previewConcurrency?: number
  previewMimeType?: string
  onPreviewError?: (id: string, error: unknown) => void
}

export function useDocumentWorkspace<Item extends DocumentWorkspaceItem>(
  options: UseDocumentWorkspaceOptions<Item>
) {
  const documents = shallowRef<Item[]>([])
  const loading = ref(false)
  const error = shallowRef<unknown>(null)
  const lastRefreshedAt = shallowRef<Date | null>(null)
  const previews = createDocumentPreviews({
    documents,
    source: options.source,
    previewConcurrency: options.previewConcurrency,
    previewMimeType: options.previewMimeType,
    onPreviewError: options.onPreviewError
      ? (id, error) => options.onPreviewError?.(id, error)
      : undefined
  })
  let refreshPromise: Promise<void> | null = null
  let refreshQueued = false
  let disposed = false

  function refresh(): Promise<void> {
    if (refreshPromise) return refreshPromise
    loading.value = true
    error.value = null
    const nextRefresh = options.source
      .refresh()
      .then((items) => {
        if (!disposed && items) {
          previews.reconcile(documents.value, items)
          documents.value = items
          lastRefreshedAt.value = new Date()
        }
        return undefined
      })
      .catch((reason: unknown) => {
        if (!disposed) error.value = reason
      })
      .finally(() => {
        loading.value = false
        refreshPromise = null
        if (refreshQueued && !disposed) {
          refreshQueued = false
          void refresh()
        }
      })
    refreshPromise = nextRefresh
    return nextRefresh
  }

  function invalidate(): Promise<void> {
    if (!refreshPromise) return refresh()
    refreshQueued = true
    return refreshPromise
  }

  if (options.refreshOnFocus !== false && IS_BROWSER) {
    useEventListener(window, 'focus', () => void invalidate())
  }
  if (options.refreshOnReconnect !== false && IS_BROWSER) {
    useEventListener(window, 'online', () => void invalidate())
  }
  if (options.refreshInterval && options.refreshInterval > 0) {
    useIntervalFn(
      () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          void invalidate()
        }
      },
      options.refreshInterval,
      { immediate: true, immediateCallback: false }
    )
  }

  let unsubscribeSource: (() => void) | null = null
  onMounted(() => {
    unsubscribeSource = options.source.subscribe?.(() => void invalidate()) ?? null
    void refresh()
  })
  onBeforeUnmount(() => {
    unsubscribeSource?.()
    disposed = true
    previews.dispose()
  })

  return {
    documents: readonly(documents) as Readonly<Ref<readonly Item[]>>,
    loading: readonly(loading),
    error: readonly(error),
    lastRefreshedAt: readonly(lastRefreshedAt),
    previewUrls: previews.previewUrls,
    previewErrors: previews.previewErrors,
    hasDocuments: computed(() => documents.value.length > 0),
    refresh,
    invalidate,
    clearPreviews: previews.clearPreviews,
    loadPreview: previews.loadPreview,
    previewDirective: previews.previewDirective,
    previewURL: previews.previewURL
  }
}
