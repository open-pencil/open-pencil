import type { StorageDocumentFormat } from '@/app/integrations/storage'
import iconDeckUrl from '@/assets/icon-deck.svg?url'
import iconPencilUrl from '@/assets/icon-pencil.svg?url'

/** UI artwork for each native cloud-storage format. New formats must register an icon here. */
export const storageDocumentIconUrls: Record<StorageDocumentFormat, string> = {
  fig: iconPencilUrl,
  deck: iconDeckUrl
}
