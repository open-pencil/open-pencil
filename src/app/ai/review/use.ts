import { markRaw, ref, type Ref } from 'vue'

import { prepareImageAttachment } from '@/app/ai/attachment/image/prepare'
import type { ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import type { EditorStore } from '@/app/editor/active-store'

import { reviewMessage } from './message'
import { reviewDesign, type ReviewDependencies } from './run'

interface ReviewOptions {
  chat: Ref<ChatInstance | null>
  ensureChat: () => Promise<ChatInstance | null>
  store: () => EditorStore | null
  flush?: () => Promise<void>
  dependencies?: ReviewDependencies
}

/** What the person asked for: the text after `/review`, and images to compare against. */
export interface ReviewAsk {
  focus?: string
  references?: readonly ImageAttachmentDraft[]
}

/**
 * Reviewing the design from the chat: the Review model's findings join the conversation as a
 * review, which the person can send on to the Design model. A review that fails leaves the
 * conversation as it was and reports why.
 */
export function useChatReview(options: ReviewOptions) {
  const reviewing = ref(false)
  /** Why the last review failed; cleared by the next one. */
  const failed = ref<unknown>(null)
  let abort: AbortController | null = null

  async function review({ focus, references = [] }: ReviewAsk): Promise<boolean> {
    const store = options.store()
    // The chat the review joins, made now in a new conversation, as a message makes it.
    const target = store ? await options.ensureChat() : null
    if (!store || !target) return false
    options.chat.value = markRaw(target)
    failed.value = null
    reviewing.value = true
    abort = new AbortController()
    const signal = abort.signal
    try {
      const images = await Promise.all(
        references.map(async (draft) => {
          const { mediaType, data } = await prepareImageAttachment(draft.file)
          return { mediaType, data }
        })
      )
      const result = await reviewDesign(
        store,
        { focus: focus || undefined, references: images, signal },
        options.dependencies
      )
      // A conversation switched meanwhile is not the one the review was asked in.
      if (signal.aborted || options.chat.value !== target) return false
      target.messages = [...target.messages, reviewMessage(result)]
      await options.flush?.().catch(() => undefined)
      return true
    } catch (error) {
      if (!signal.aborted) failed.value = error
      return false
    } finally {
      reviewing.value = false
      abort = null
    }
  }

  /** Stops the review in progress, which then adds nothing. */
  function stop(): void {
    abort?.abort()
  }

  return { reviewing, failed, review, stop }
}
