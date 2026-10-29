import { useEventListener } from '@vueuse/core'
import { shallowRef, toValue, type MaybeRefOrGetter, type Ref } from 'vue'

import { isAttachableImageFile } from '@/app/ai/attachment/image/prepare'

/**
 * Takes images dropped anywhere on `target` for the chat. A drag carrying no image, such as a
 * `.fig`, is left to the window, which opens documents; the other files of a mixed drop go there
 * too, since nothing here stops the event.
 *
 * Whether a drag carries an image is decided once, when it enters. VueUse's `useDropZone` checks
 * every event and skips its enter/leave count when one fails, which WebKit outside Safari does for
 * files other apps provide late (Yoink, for one), and the overlay then stayed after the drag.
 */
export function useImageDrop(
  target: Ref<HTMLElement | null>,
  options: { enabled: MaybeRefOrGetter<boolean>; onImages: (files: File[]) => void }
) {
  const dragging = shallowRef(false)
  // Enter and leave fire for every element the drag crosses inside the target.
  let depth = 0

  function carriesImage(event: DragEvent) {
    // Only the item types are readable while dragging; the files arrive with the drop.
    return Array.from(event.dataTransfer?.items ?? []).some(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    )
  }

  function reset() {
    depth = 0
    dragging.value = false
  }

  useEventListener(target, 'dragenter', (event: DragEvent) => {
    depth += 1
    if (depth === 1) dragging.value = toValue(options.enabled) && carriesImage(event)
    if (dragging.value) event.preventDefault()
  })
  useEventListener(target, 'dragover', (event: DragEvent) => {
    if (!dragging.value) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  })
  useEventListener(target, 'dragleave', () => {
    depth = Math.max(0, depth - 1)
    if (depth === 0) dragging.value = false
  })
  useEventListener(target, 'drop', (event: DragEvent) => {
    const ours = dragging.value
    reset()
    if (!ours) return
    event.preventDefault()
    const images = Array.from(event.dataTransfer?.files ?? []).filter(isAttachableImageFile)
    if (images.length > 0) options.onImages(images)
  })
  // No pointer events reach the page during a drag, so the first one means it ended, even when
  // it ended without a leave or drop reaching the target.
  useEventListener(window, 'pointermove', () => {
    if (dragging.value || depth > 0) reset()
  })

  return { dragging }
}
