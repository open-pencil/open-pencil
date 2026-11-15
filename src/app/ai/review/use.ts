import { markRaw, ref, type Ref } from 'vue'

import { locale, LOCALE_LABELS } from '@open-pencil/vue/i18n'

import { prepareImageAttachment } from '@/app/ai/attachment/image/prepare'
import type { ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import { readToolChange } from '@/app/ai/tools/changes/store'
import type { EditorStore } from '@/app/editor/active-store'

import { reviewMessage, type DesignReview } from './message'
import { reviewChange, reviewDesign, reviewTarget, type ReviewDependencies } from './run'

interface ReviewOptions {
  chat: Ref<ChatInstance | null>
  ensureChat: () => Promise<ChatInstance | null>
  store: () => EditorStore | null
  /** Changes when the chat shows another conversation, so a review asked in one stays there. */
  generation?: () => number
  flush?: () => Promise<void>
  dependencies?: ReviewDependencies
}

/** What the person asked for: the text after `/review`, and images to compare against. */
export interface ReviewAsk {
  focus?: string
  references?: readonly ImageAttachmentDraft[]
}

/**
 * The language a review is written in when the request names none: the interface's, by its own
 * name, as `Русский` or `日本語`.
 */
export function interfaceLanguage(): string {
  return LOCALE_LABELS[locale.get()]
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
   * Runs one review and adds it to the conversation it was asked in, once it is in. One review
   * runs at a time: another asked meanwhile is not started.
   */
  async function run(write: (signal: AbortSignal) => Promise<DesignReview>): Promise<boolean> {
    if (reviewing.value) return false
    const generation = options.generation?.()
    const moved = () => options.generation?.() !== generation
    failed.value = null
    reviewing.value = true
    abort = new AbortController()
    const signal = abort.signal
    // Read afresh after each await; Stop can end the review while it waits.
    const stopped = () => signal.aborted
    try {
      // The chat the review joins, made now in a new conversation, as a message makes it.
      const target = await options.ensureChat()
      if (!target || stopped() || moved()) return false
      options.chat.value = markRaw(target)
      const result = await write(signal)
      // A conversation switched meanwhile is not the one the review was asked in.
      if (stopped() || moved() || options.chat.value !== target) return false
      target.messages = [...target.messages, reviewMessage(result)]
      await options.flush?.().catch(() => undefined)
      return true
    } catch (error) {
      if (!stopped()) failed.value = error
      return false
    } finally {
      reviewing.value = false
      abort = null
    }
  }

  /** Reviews the selection or the page as it is now, from `/review`. */
  function review({ focus, references = [] }: ReviewAsk): Promise<boolean> {
    const store = options.store()
    if (!store) return Promise.resolve(false)
    const target = reviewTarget(store)
    return run(async (signal) => {
      const images = await Promise.all(
        references.map(async (draft) => {
          const { mediaType, data } = await prepareImageAttachment(draft.file)
          return { mediaType, data }
        })
      )
      return reviewDesign(
        store,
        {
          ...target,
          focus: focus || undefined,
          references: images,
          language: interfaceLanguage(),
          signal
        },
        options.dependencies
      )
    })
  }

  /** Reviews one AI edit, from its change preview. False when the chat keeps no such change. */
  function reviewToolChange(toolCallId: string): Promise<boolean> {
    const change = readToolChange(toolCallId)
    if (!change) return Promise.resolve(false)
    return run((signal) =>
      reviewChange(change, { signal, language: interfaceLanguage() }, options.dependencies)
    )
  }

  /** Stops the review in progress, which then adds nothing. */
  function stop(): void {
    abort?.abort()
  }

  return { reviewing, failed, review, reviewToolChange, stop }
}
