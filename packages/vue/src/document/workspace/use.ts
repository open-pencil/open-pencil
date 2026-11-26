import { computed, onBeforeUnmount, onMounted, readonly, ref, shallowRef, type Ref } from 'vue'

import { useAutoRefresh } from '#vue/shared/refresh'

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
  let disposed = false

  async function load(): Promise<void> {
    loading.value = true
    try {
      const items = await options.source.refresh()
      if (!disposed && items) {
        previews.reconcile(documents.value, items)
        error.value = null
        documents.value = items
        lastRefreshedAt.value = new Date()
      }
    } catch (reason: unknown) {
      if (!disposed) error.value = reason
    } finally {
      loading.value = false
    }
  }

  const { refresh, invalidate, cancelQueued } = useAutoRefresh(load, {
    interval: options.refreshInterval,
    onFocus: options.refreshOnFocus,
    onReconnect: options.refreshOnReconnect
  })

  let unsubscribeSource: (() => void) | null = null
  onMounted(() => {
    unsubscribeSource = options.source.subscribe?.(() => void invalidate()) ?? null
    void refresh()
  })
  onBeforeUnmount(() => {
    unsubscribeSource?.()
    disposed = true
    cancelQueued()
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
