export const IMAGE_ATTACHMENT_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export type ImageAttachmentMediaType = (typeof IMAGE_ATTACHMENT_MEDIA_TYPES)[number]

export const MAX_IMAGE_ATTACHMENTS = 4

export type ImageAttachmentDraft = {
  file: File
  previewURL: string
}

export type ImageAttachmentPresentation = {
  id: string
  messageId: string
  name: string
  mediaType: ImageAttachmentMediaType
  originalWidth: number
  originalHeight: number
  previewWidth: number
  previewHeight: number
  previewURL: string
  displayText: string
}

export type PreparedImageAttachment = {
  data: Uint8Array
  blob: Blob
  mediaType: ImageAttachmentMediaType
  originalWidth: number
  originalHeight: number
  width: number
  height: number
}
