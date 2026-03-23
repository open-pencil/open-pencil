import { watchDebounced } from '@vueuse/core'
import { onScopeDispose, shallowRef, type Ref } from 'vue'

import type { EditorStore } from '@/stores/editor'

const BATCH_SIZE = 10

export function useComponentThumbnails(store: EditorStore, componentIds: Ref<string[]>) {
  const thumbnails = shallowRef(new Map<string, string>())
  let pending = false
  let needsRefresh = false

  function refresh() {
    if (pending) {
      needsRefresh = true
      return
    }
    pending = true

    const oldMap = thumbnails.value
    const currentIds = componentIds.value
    const currentSet = new Set(currentIds)
    const newMap = new Map<string, string>()

    for (const [id, url] of oldMap) {
      if (currentSet.has(id)) {
        newMap.set(id, url)
      } else {
        URL.revokeObjectURL(url)
      }
    }

    const toRender = currentIds.filter((id) => !newMap.has(id))
    if (toRender.length === 0) {
      thumbnails.value = newMap
      pending = false
      return
    }

    let i = 0
    function renderBatch() {
      const end = Math.min(i + BATCH_SIZE, toRender.length)
      for (; i < end; i++) {
        const id = toRender[i]
        try {
          const url = store.renderComponentThumbnail(id)
          if (url) newMap.set(id, url)
        } catch (e) {
          console.warn('Thumbnail render failed:', e)
        }
      }
      if (i < toRender.length) {
        requestAnimationFrame(renderBatch)
      } else {
        thumbnails.value = new Map(newMap)
        pending = false
        if (needsRefresh) {
          needsRefresh = false
          refresh()
        }
      }
    }
    renderBatch()
  }

  function fullRefresh() {
    for (const url of thumbnails.value.values()) URL.revokeObjectURL(url)
    thumbnails.value = new Map()
    pending = false
    needsRefresh = false
    refresh()
  }

  watchDebounced(componentIds, refresh, { debounce: 100, immediate: true })
  watchDebounced(() => store.state.sceneVersion, fullRefresh, { debounce: 500 })

  onScopeDispose(() => {
    for (const url of thumbnails.value.values()) URL.revokeObjectURL(url)
  })

  return thumbnails
}
