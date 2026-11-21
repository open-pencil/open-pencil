import { type MaybeComputedElementRef, unrefElement, useResizeObserver } from '@vueuse/core'
import { type WatchSource, ref, watch } from 'vue'

export function useLayerNameCut(name: MaybeComputedElementRef, text: WatchSource<string>) {
  const cut = ref(false)

  function measure() {
    const element = unrefElement(name)
    cut.value = !!element && element.scrollWidth > element.clientWidth
  }

  useResizeObserver(name, measure)
  watch(text, measure, { flush: 'post' })

  return cut
}
