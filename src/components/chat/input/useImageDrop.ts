import { useDropZone } from '@vueuse/core'
import { toValue, type MaybeRefOrGetter, type Ref } from 'vue'

import { isAttachableImageFile } from '@/app/ai/attachment/image/prepare'

/**
 * Takes images dropped anywhere on `target` for the chat. A drag carrying no image, such as a
 * `.fig`, is left to the window, which opens documents; the other files of a mixed drop go there
 * too, since nothing here stops the event.
 */
export function useImageDrop(
  target: Ref<HTMLElement | null>,
  options: { enabled: MaybeRefOrGetter<boolean>; onImages: (files: File[]) => void }
) {
  const { isOverDropZone } = useDropZone(target, {
    // Only the item types are readable while dragging; the files arrive with the drop.
    checkValidity: (items) =>
      toValue(options.enabled) &&
      Array.from(items).some((item) => item.kind === 'file' && item.type.startsWith('image/')),
    onDrop: (files) => {
      const images = (files ?? []).filter(isAttachableImageFile)
      if (images.length > 0) options.onImages(images)
    }
  })
  return { dragging: isOverDropZone }
}
