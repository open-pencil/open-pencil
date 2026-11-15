import { setVisibleMessageText } from '@/app/ai/chat/presentation'
import type { ChatInstance, ChatSubmission } from '@/app/ai/chat/submission/types'

type WithTurn = (chat: ChatInstance, send: () => Promise<void>) => Promise<void>

/** Sends a message without attachments; the chat adds it at once and shows the written text. */
export async function sendText(
  chat: ChatInstance,
  submission: ChatSubmission,
  dispatch: () => void,
  withTurn: WithTurn
): Promise<void> {
  const previousIds = new Set(chat.messages.map((message) => message.id))
  dispatch()
  await withTurn(chat, () =>
    chat.sendMessage({ text: submission.modelText }).catch(() => undefined)
  )
  const message = chat.messages.find(
    (candidate) => candidate.role === 'user' && !previousIds.has(candidate.id)
  )
  if (message) setVisibleMessageText(message.id, submission.displayText)
}
