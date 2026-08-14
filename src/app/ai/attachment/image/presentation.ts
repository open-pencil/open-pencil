import { computed, shallowReactive } from 'vue'

import { revokeImagePreviewURL } from '@/app/ai/attachment/image/prepare'
import type { ImageAttachmentPresentation } from '@/app/ai/attachment/image/types'

const attachments = shallowReactive(new Map<string, ImageAttachmentPresentation[]>())

export function visibleUserMessageText(messageId: string, text: string): string {
  const attachment = attachments.get(messageId)?.[0]
  return attachment?.displayText ?? text
}

export function imageAttachmentsForMessage(messageId: string) {
  return computed(() => attachments.get(messageId) ?? [])
}

export function setImageAttachmentPresentations(
  messageId: string,
  nextAttachments: ImageAttachmentPresentation[]
): void {
  const previous = attachments.get(messageId)
  if (previous) {
    const retainedURLs = new Set(nextAttachments.map((attachment) => attachment.previewURL))
    for (const staleAttachment of previous) {
      if (!retainedURLs.has(staleAttachment.previewURL)) {
        revokeImagePreviewURL(staleAttachment.previewURL)
      }
    }
  }
  attachments.set(messageId, nextAttachments)
}

export function clearImageAttachmentPresentations(): void {
  for (const messageAttachments of attachments.values()) {
    for (const attachment of messageAttachments) {
      revokeImagePreviewURL(attachment.previewURL)
    }
  }
  attachments.clear()
}
