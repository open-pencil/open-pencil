import type { ImageAttachmentDraft, PreparedImageAttachment } from '@/app/ai/attachment/image/types'
import type { ImagePresentation } from '@/app/ai/attachment/presentation/types'

export function imageDraftPresentations(
  messageId: string,
  images: ImageAttachmentDraft[]
): ImagePresentation[] {
  return images.map((image) => ({
    id: crypto.randomUUID(),
    messageId,
    kind: 'image',
    name: image.file.name,
    preview: image.file,
    mediaType:
      image.file.type === 'image/jpeg' ||
      image.file.type === 'image/webp' ||
      image.file.type === 'image/png'
        ? image.file.type
        : 'image/png',
    originalSize: { x: 0, y: 0 }
  }))
}

export function preparedImagePresentations(
  messageId: string,
  drafts: ImageAttachmentDraft[],
  images: PreparedImageAttachment[]
): ImagePresentation[] {
  return images.map((image, index) => ({
    id: crypto.randomUUID(),
    messageId,
    kind: 'image',
    name: drafts[index]?.file.name ?? `Image ${index + 1}`,
    preview: image.blob,
    mediaType: image.mediaType,
    originalSize: { x: image.originalWidth, y: image.originalHeight }
  }))
}
