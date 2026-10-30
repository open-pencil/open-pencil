import type { UIMessage } from 'ai'
import type { RootContent } from 'mdast'

import { aiMessages } from '@open-pencil/vue/i18n'

import { showChatPanel } from '@/app/ai/chat/panel'
import type { EditorStore } from '@/app/editor/session'
import { appPreferences } from '@/app/settings/preferences/store'
import { notify, type NotificationEvent } from '@/app/shell/notifications'
import { getTabForStore, switchTab } from '@/app/tabs'

/** How much of a finished reply the notification quotes, as Codex quotes 200 characters. */
const REPLY_PREVIEW_LENGTH = 200

/**
 * The reply's last text, which is its answer, as plain text: text before its tool calls only
 * announced them, and a notification shows markdown, links, and code as their raw source.
 */
async function replyPreview(message: UIMessage): Promise<string> {
  const answer = message.parts.findLast((part) => part.type === 'text')
  if (!answer) return ''
  const [{ fromMarkdown }, { toString }, { gfmFromMarkdown }, { gfm }] = await Promise.all([
    import('mdast-util-from-markdown'),
    import('mdast-util-to-string'),
    import('mdast-util-gfm'),
    import('micromark-extension-gfm')
  ])
  const root = fromMarkdown(answer.text, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })
  // Lines of text read as their words; lists and quotes as their lines in turn, while tables
  // and code do not read as a sentence, so the preview keeps to the prose.
  const lines = (node: RootContent): string[] => {
    if (node.type === 'paragraph' || node.type === 'heading') return [toString(node)]
    if (node.type === 'list' || node.type === 'listItem' || node.type === 'blockquote')
      return node.children.flatMap(lines)
    return []
  }
  const text = root.children.flatMap(lines).join(' ').replaceAll(/\s+/g, ' ').trim()
  if (text.length <= REPLY_PREVIEW_LENGTH) return text
  const cut = text.slice(0, REPLY_PREVIEW_LENGTH)
  return `${cut.slice(0, cut.lastIndexOf(' ') + 1 || REPLY_PREVIEW_LENGTH).trimEnd()}…`
}

/**
 * Notifies about the chat of `store`'s document, titled with who replied and where; a click shows
 * that tab's chat, with the panels the person may have hidden. A document whose tab closed has no
 * chat to show, so it sends nothing, and a click after its tab closed does nothing.
 */
function notifyChat(
  event: NotificationEvent,
  store: EditorStore,
  agent: string,
  body: string
): void {
  const tabId = getTabForStore(store)?.id
  if (!tabId) return
  notify({
    event,
    title: aiMessages.get().notifyTitle({ agent, document: store.state.documentName }),
    body,
    tabId,
    // One per tab, so an agent that keeps working replaces its last notification.
    tag: `agent:${tabId}`,
    open: () => {
      if (!switchTab(tabId)) return
      store.state.showUI = true
      showChatPanel()
    }
  })
}

/** A reply by `agent` ended on its own: `message` is the reply, or null when it failed. */
export async function notifyReplyEnded(
  store: EditorStore,
  agent: string,
  message: UIMessage | null
): Promise<void> {
  const messages = aiMessages.get()
  if (!message) {
    notifyChat('agentFailed', store, agent, messages.notifyReplyFailed)
    return
  }
  // The preview loads a Markdown parser, which a reply nobody asked to hear about does not need.
  if (!appPreferences.value.notifications.agentFinished) return
  // A parser that fails to load leaves the plain announcement rather than no notification.
  const preview = await replyPreview(message).catch(() => '')
  notifyChat('agentFinished', store, agent, preview || messages.notifyReplyFinished)
}

/** An agent's permission request is still waiting for an answer. */
export function notifyPermissionWaiting(store: EditorStore, agent: string, action: string): void {
  const messages = aiMessages.get()
  notifyChat(
    'agentNeedsInput',
    store,
    agent,
    action ? messages.notifyPermissionAction({ action }) : messages.notifyPermission
  )
}
