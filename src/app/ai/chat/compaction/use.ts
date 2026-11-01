import { ref, type Ref } from 'vue'

import { compactAutomatically } from '@/app/ai/chat/preferences'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import { createAIModelRuntime } from '@/app/ai/models/runtime'

import { autoCompactAt, contextTokensSinceCompaction, designContextLimits } from './limits'
import { compactionMessage, type Compaction } from './marker'
import { summarizeConversation } from './summarize'

interface CompactionOptions {
  chat: Ref<ChatInstance | null>
  ensureChat: () => Promise<ChatInstance | null>
  flush?: () => Promise<void>
}

/**
 * Compacting a conversation: its model summarizes it, and the summary stands for everything
 * before it in later requests. A failed compaction leaves the conversation as it was.
 */
export function useChatCompaction(options: CompactionOptions) {
  const compacting = ref(false)
  /** The last compaction that failed, for its Retry; cleared by the next one. */
  const failed = ref<{ trigger: Compaction['trigger']; instructions?: string } | null>(null)
  let abort: AbortController | null = null

  async function compact(
    trigger: Compaction['trigger'],
    instructions?: string,
    chat?: ChatInstance
  ): Promise<boolean> {
    if (compacting.value) return false
    const target = chat ?? options.chat.value ?? (await options.ensureChat())
    if (!target || target.messages.length === 0) return false
    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'direct') return false
    compacting.value = true
    failed.value = null
    abort = new AbortController()
    try {
      const tokensBefore = contextTokensSinceCompaction(target.messages)
      const summary = await summarizeConversation({
        model: runtime.model,
        messages: target.messages,
        instructions,
        abortSignal: abort.signal
      })
      target.messages = [...target.messages, compactionMessage({ summary, trigger, tokensBefore })]
      await options.flush?.().catch(() => undefined)
      return true
    } catch {
      if (!abort.signal.aborted) failed.value = { trigger, instructions }
      return false
    } finally {
      compacting.value = false
      abort = null
    }
  }

  /** Before a message goes, compacts a conversation whose last request passed the threshold. */
  async function compactIfFull(chat: ChatInstance): Promise<void> {
    if (!compactAutomatically.value) return
    const used = contextTokensSinceCompaction(chat.messages)
    if (used === null) return
    const limits = await designContextLimits()
    if (limits && used >= autoCompactAt(limits)) await compact('auto', undefined, chat)
  }

  /** Stops a compaction in progress; the conversation stays as it was. */
  function cancel(): void {
    abort?.abort()
  }

  function retry(): Promise<boolean> {
    const last = failed.value
    return last ? compact(last.trigger, last.instructions) : Promise.resolve(false)
  }

  return { compacting, failed, compact, compactIfFull, cancel, retry }
}
