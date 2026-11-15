import { markRaw, ref, type Ref } from 'vue'

import { prepareImageAttachment } from '@/app/ai/attachment/image/prepare'
import type { ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import { readToolChange } from '@/app/ai/tools/changes/store'
import type { EditorStore } from '@/app/editor/active-store'

import { reviewMessage, type DesignReview } from './message'
import { reviewChange, reviewDesign, type ReviewDependencies } from './run'

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

  /**
   * Runs one review and adds it to the conversation it was asked in, once it is in. A review that
   * runs while another does is not started.
   */
  async function run(
    write: (store: EditorStore, signal: AbortSignal) => Promise<DesignReview>
  ): Promise<boolean> {
    const store = options.store()
    if (!store || reviewing.value) return false
    // The chat the review joins, made now in a new conversation, as a message makes it.
    const target = await options.ensureChat()
    if (!target) return false
    options.chat.value = markRaw(target)
    failed.value = null
    reviewing.value = true
    abort = new AbortController()
    const signal = abort.signal
    try {
      const result = await write(store, signal)
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

  /** Reviews the selection or the page, from `/review`. */
  function review({ focus, references = [] }: ReviewAsk): Promise<boolean> {
    return run(async (store, signal) => {
      const images = await Promise.all(
        references.map(async (draft) => {
          const { mediaType, data } = await prepareImageAttachment(draft.file)
          return { mediaType, data }
        })
      )
      return reviewDesign(
        store,
        { focus: focus || undefined, references: images, signal },
        options.dependencies
      )
    })
  }

  /** Reviews one AI edit, from its change preview. False when the chat keeps no such change. */
  function reviewToolChange(toolCallId: string): Promise<boolean> {
    const change = readToolChange(toolCallId)
    if (!change) return Promise.resolve(false)
    return run((_store, signal) => reviewChange(change, { signal }, options.dependencies))
  }

  /** Stops the review in progress, which then adds nothing. */
  function stop(): void {
    abort?.abort()
  }

  return { reviewing, failed, review, reviewToolChange, stop }
}
