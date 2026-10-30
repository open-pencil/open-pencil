import type { UIMessage } from 'ai'

import { aiMessages } from '@open-pencil/vue/i18n'

import { showChatPanel } from '@/app/ai/chat/panel'
import type { EditorStore } from '@/app/editor/session'
import { notify, type NotificationEvent } from '@/app/shell/notifications'
import { getTabForStore, switchTab } from '@/app/tabs'

/** How much of a finished reply the notification quotes. */
const REPLY_EXCERPT_LENGTH = 160

/** The reply's text, cut at a word near the length a notification shows. */
function replyExcerpt(message: UIMessage): string {
  const text = message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
  if (text.length <= REPLY_EXCERPT_LENGTH) return text
  const cut = text.slice(0, REPLY_EXCERPT_LENGTH)
  return `${cut.slice(0, cut.lastIndexOf(' ') + 1 || REPLY_EXCERPT_LENGTH).trimEnd()}…`
}

/** Notifies about the chat of `store`'s document; a click shows that tab's chat. */
function notifyChat(event: NotificationEvent, store: EditorStore, body: string): void {
  const tabId = getTabForStore(store)?.id ?? null
  notify({
    event,
    title: store.state.documentName,
    body,
    tabId,
    // One per tab, so an agent that keeps working replaces its last notification.
    tag: `agent:${tabId ?? 'none'}`,
    open: () => {
      if (tabId) switchTab(tabId)
      showChatPanel()
    }
  })
}

/** A reply ended on its own: `message` is the reply, or null when it failed. */
export function notifyReplyEnded(store: EditorStore, message: UIMessage | null): void {
  const messages = aiMessages.get()
  if (message)
    notifyChat('agentFinished', store, replyExcerpt(message) || messages.notifyReplyFinished)
  else notifyChat('agentFailed', store, messages.notifyReplyFailed)
}

/** An agent's permission request is still waiting for an answer. */
export function notifyPermissionWaiting(store: EditorStore, agent: string, action: string): void {
  const messages = aiMessages.get()
  notifyChat(
    'agentNeedsInput',
    store,
    action
      ? messages.notifyPermissionAction({ agent, action })
      : messages.notifyPermission({ agent })
  )
}
