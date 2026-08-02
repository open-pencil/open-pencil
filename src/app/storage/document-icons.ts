import type { StorageDocumentFormat } from '@/app/integrations/storage'
import iconDesignUrl from '@/assets/icon-design.svg?url'
import iconSlidesUrl from '@/assets/icon-slides.svg?url'

/** UI artwork for each native cloud-storage format. New formats must register an icon here. */
export const storageDocumentIconUrls: Record<StorageDocumentFormat, string> = {
  fig: iconDesignUrl,
  deck: iconSlidesUrl
}
