import { useObjectUrl } from '@vueuse/core'
import { shallowRef, watch, type MaybeRefOrGetter, toValue } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'

/**
 * The stored image an image fill names, as a URL to show. `measure` also decodes it for its size
 * in pixels, which only the picker needs; a swatch in every paint row stays a URL.
 */
export function useImageFill(
  hash: MaybeRefOrGetter<string | undefined>,
  { measure = false }: { measure?: boolean } = {}
) {
  const store = useEditorStore()
  const blob = shallowRef<Blob | null>(null)
  const url = useObjectUrl(blob)
  const size = shallowRef<{ width: number; height: number } | null>(null)

  watch(
    () => toValue(hash),
    (name) => {
      const data = name ? store.getImage(name) : undefined
      // A copy owns a plain ArrayBuffer, which a Blob takes where shared memory is not allowed.
      blob.value = data ? new Blob([data.slice()]) : null
    },
    { immediate: true }
  )
  if (measure)
    watch(
      blob,
      async (current) => {
        size.value = null
        if (!current) return
        // Bytes the browser cannot decode leave the size unknown, as before it loads.
        const bitmap = await createImageBitmap(current).catch(() => null)
        if (!bitmap) return
        if (blob.value === current) size.value = { width: bitmap.width, height: bitmap.height }
        bitmap.close()
      },
      { immediate: true }
    )

  return { url, size }
}
