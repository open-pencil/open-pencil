import { markRaw, type Ref } from 'vue'

import { reportSubmissionError, type SubmissionErrorOptions } from '@/app/ai/chat/submission/errors'
import type { ChatInstance } from '@/app/ai/chat/submission/types'

interface ResendOptions extends SubmissionErrorOptions {
  chat: Ref<ChatInstance | null>
  ensureChat: () => Promise<ChatInstance | null>
}

/**
 * The chat to ask again with. A key or model changed since the chat was made, such as after a
 * failure that sent the user to Settings, makes `ensureChat` rebuild it with the same messages.
 */
export async function chatToResend(
  options: ResendOptions,
  ready: ChatInstance | null
): Promise<ChatInstance | null> {
  if (!ready) return null
  try {
    const current = await options.ensureChat()
    // Another tab or a new message took the chat over while it was being made.
    if (options.chat.value !== ready) return null
    if (current && current !== ready) options.chat.value = markRaw(current)
    return current
  } catch (error) {
    reportSubmissionError(options, error)
    return null
  }
}
