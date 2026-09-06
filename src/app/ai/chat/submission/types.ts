import type { ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import type { ReferencedNode } from '@/app/ai/chat/context'

export interface ChatSubmission {
  modelText: string
  displayText: string
  images: ImageAttachmentDraft[]
  nodes: ReferencedNode[]
}
