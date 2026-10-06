import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'

import type { ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import type { ReferencedNode } from '@/app/ai/chat/context'

export interface ChatSubmission {
  modelText: string
  displayText: string
  images: ImageAttachmentDraft[]
  nodes: ReferencedNode[]
}

/** The part of the AI SDK Chat that submissions drive. */
export type ChatInstance = Pick<
  Chat<UIMessage>,
  'messages' | 'sendMessage' | 'stop' | 'regenerate' | 'status'
>
