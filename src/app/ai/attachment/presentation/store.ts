import { computed, shallowReactive } from 'vue'

import type { AttachmentPresentation } from './types'

const attachments = shallowReactive(new Map<string, AttachmentPresentation[]>())

export function attachmentsForMessage(messageId: string) {
  return computed(() => attachments.get(messageId) ?? [])
}

export function setMessageAttachments(
  messageId: string,
  nextAttachments: AttachmentPresentation[]
): void {
  attachments.set(messageId, nextAttachments)
}

export function clearMessageAttachments(): void {
  attachments.clear()
}
