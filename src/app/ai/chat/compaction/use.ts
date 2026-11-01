import { ref, type Ref } from 'vue'

import { compactAutomatically } from '@/app/ai/chat/preferences'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import { createAIModelRuntime } from '@/app/ai/models/runtime'

import {
  autoCompactAt,
  contextTokensSinceCompaction,
  designContextLimits,
  estimatedTokens
} from './limits'
import { compactionMessage, type Compaction } from './marker'
import { summarizeConversation } from './summarize'

interface CompactionOptions {
  chat: Ref<ChatInstance | null>
  ensureChat: () => Promise<ChatInstance | null>
  flush?: () => Promise<void>
}

interface CompactRequest {
  trigger: Compaction['trigger']
  instructions?: string
  /** Compacts only the messages before this one, which stays after the summary to send again. */
  before?: string
  chat?: ChatInstance
}

/** The chat is replying, so a summary now would cut its reply off from the next request. */
function replying(chat: ChatInstance): boolean {
  return chat.status === 'streaming' || chat.status === 'submitted'
}

/**
 * Compacting a conversation: its model summarizes it, and the summary stands for everything
 * before it in later requests. A failed compaction leaves the conversation as it was.
 */
export function useChatCompaction(options: CompactionOptions) {
  const compacting = ref(false)
  /** The last compaction that failed, for its Retry; cleared by the next one. */
  const failed = ref<Omit<CompactRequest, 'chat'> | null>(null)
  let abort: AbortController | null = null
  /** The compaction in progress, which a message sent meanwhile waits for. */
  let pending: Promise<boolean> | null = null

  async function run(request: CompactRequest): Promise<boolean> {
    const target = request.chat ?? options.chat.value ?? (await options.ensureChat())
    if (!target || target.messages.length === 0 || replying(target)) return false
    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'direct') return false
    const at = request.before
      ? target.messages.findIndex((message) => message.id === request.before)
      : target.messages.length
    if (at <= 0) return false
    const covered = target.messages.slice(0, at)
    compacting.value = true
    failed.value = null
    abort = new AbortController()
    try {
      const summary = await summarizeConversation({
        model: runtime.model,
        messages: covered,
        instructions: request.instructions,
        abortSignal: abort.signal
      })
      // A conversation switched meanwhile is no longer the one summarized.
      if (!request.chat && options.chat.value !== target) return false
      const marker = compactionMessage({
        summary,
        trigger: request.trigger,
        tokensBefore: contextTokensSinceCompaction(covered)
      })
      target.messages = [...covered, marker, ...target.messages.slice(at)]
      await options.flush?.().catch(() => undefined)
      return true
    } catch {
      if (!abort.signal.aborted) {
        const { chat: _chat, ...retry } = request
        failed.value = retry
      }
      return false
    } finally {
      compacting.value = false
      abort = null
    }
  }

  /** Compacts the conversation; one compaction runs at a time. */
  function compact(request: CompactRequest): Promise<boolean> {
    if (pending) return Promise.resolve(false)
    pending = run(request).finally(() => {
      pending = null
    })
    return pending
  }

  /**
   * Before `text` is sent: waits for a compaction in progress, then compacts when the last
   * request since the latest summary, with `text` added, passes the threshold.
   */
  async function compactIfFull(chat: ChatInstance, text: string): Promise<void> {
    if (pending) await pending
    if (!compactAutomatically.value) return
    const used = contextTokensSinceCompaction(chat.messages)
    if (used === null) return
    const limits = await designContextLimits()
    if (limits && used + estimatedTokens(text) >= autoCompactAt(limits))
      await compact({ trigger: 'auto', chat })
  }

  /** Stops a compaction in progress; the conversation stays as it was. */
  function cancel(): void {
    abort?.abort()
  }

  function retry(): Promise<boolean> {
    const last = failed.value
    return last ? compact(last) : Promise.resolve(false)
  }

  return { compacting, failed, compact, compactIfFull, cancel, retry }
}
