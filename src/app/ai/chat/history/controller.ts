import type { UIMessage } from 'ai'
import { omit } from 'es-toolkit'
import { computed, ref, shallowRef } from 'vue'

import { chatDocumentId, resolveChatDocumentId, type ChatDocumentEditor } from './document'
import { createConversationStore } from './idb'
import { restoreMessages } from './messages'
import { createHistoryPersistence } from './persistence'
import { createHistorySession } from './session'
import type {
  AgentSessionRef,
  Conversation,
  ConversationMeta,
  ConversationStore,
  HistoryChat,
  HistoryRuntime
} from './types'

/** Coordinates document ownership and serialized public conversation actions. */
export function createConversationHistory<TChat extends HistoryChat>(
  runtime: HistoryRuntime<TChat>,
  store: ConversationStore = createConversationStore()
) {
  const current = shallowRef<Conversation | null>(null)
  const messages = shallowRef<UIMessage[]>([])
  const conversations = ref<ConversationMeta[]>([])
  const readOnly = ref(false)
  /** The live chat's agent could not continue the saved session, so that chat takes no more. */
  const chatEnded = ref(false)
  const busy = ref(false)
  let ownerRecoveryId: string | null = null
  // Weak, so the history does not keep a closed document's editor alive.
  let owner: WeakRef<ChatDocumentEditor> | null = null
  let operation: Promise<unknown> = Promise.resolve()
  const session = createHistorySession(() => runtime.resetChat())
  const { flush, storageError } = createHistoryPersistence({
    store,
    current,
    messages,
    readOnly,
    refresh,
    content: () => ({
      messages: session.chat?.messages ?? messages.value,
      interrupted: session.interrupted
    })
  })

  function serialize<T>(run: () => Promise<T>): Promise<T> {
    const next = operation.then(async () => {
      busy.value = true
      try {
        return await run()
      } finally {
        busy.value = false
      }
    })
    operation = next.catch(() => undefined)
    return next
  }

  async function refresh() {
    conversations.value = await store.list()
  }
  function detach() {
    chatEnded.value = false
    return session.detach(flush)
  }

  async function activate(conversation: Conversation) {
    const editor = runtime.getEditor()
    owner = new WeakRef(editor)
    ownerRecoveryId = editor.getRecoveryId()
    session.restoreInterrupted(conversation.interrupted)
    readOnly.value = conversation.documentId !== chatDocumentId(editor)
    current.value = conversation
    messages.value = restoreMessages(conversation.messages)
    if (conversation.messages.length || conversation.titleSource !== 'fallback') {
      await store.select(conversation.documentId, conversation.id)
    }
  }

  async function createDraft() {
    const editor = runtime.getEditor()
    const now = new Date().toISOString()
    await activate({
      id: crypto.randomUUID(),
      documentId: await resolveChatDocumentId(editor, store),
      documentName: editor.state.documentName,
      title: '',
      titleSource: 'fallback',
      createdAt: now,
      updatedAt: now,
      profileId: runtime.profileId(),
      backend: runtime.backend(),
      interrupted: false,
      messages: []
    })
    await refresh()
  }

  function isIdentityChange(editor: ChatDocumentEditor, documentId: string) {
    return (
      owner?.deref() === editor &&
      ownerRecoveryId === editor.getRecoveryId() &&
      current.value &&
      !readOnly.value &&
      current.value.documentId !== documentId
    )
  }

  async function reassignDocument(editor: ChatDocumentEditor, documentId: string) {
    if (!current.value) return
    await flush()
    await store.reassignDocument(current.value.documentId, documentId, editor.state.documentName)
    current.value = { ...current.value, documentId, documentName: editor.state.documentName }
    await refresh()
  }

  async function loadDocument() {
    const editor = runtime.getEditor()
    const documentId = await resolveChatDocumentId(editor, store)
    if (isIdentityChange(editor, documentId)) await reassignDocument(editor, documentId)
    if (current.value?.documentId === documentId) {
      readOnly.value = false
      owner = new WeakRef(editor)
      ownerRecoveryId = editor.getRecoveryId()
      return
    }
    await detach()
    const id = await store.getSelected(documentId)
    const conversation = id ? await store.read(id) : null
    if (conversation?.documentId === documentId) await activate(conversation)
    else await createDraft()
    await refresh()
  }

  /** The saved agent session the chat's agent continues, when it is that agent's. */
  function resumableSession(conversation: Conversation | null): string | null {
    const saved = conversation?.agentSession
    return saved && saved.agent === runtime.resumingAgent() ? saved.id : null
  }
  const continuesAgentSession = computed(() => resumableSession(current.value) !== null)
  /**
   * A saved transcript no chat can continue: it ran on an external agent, or the chat now runs on
   * one, and that agent does not continue its saved session.
   */
  const agentReadOnly = computed(() => {
    const conversation = current.value
    if (!conversation?.messages.length || continuesAgentSession.value) return false
    return runtime.backend() !== 'direct' || conversation.backend !== 'direct'
  })

  /** Saves or forgets the session a conversation's agent runs in, while it is current. */
  function recordAgentSession(conversationId: string, agentSession: AgentSessionRef | null) {
    const conversation = current.value
    if (!conversation || conversation.id !== conversationId) return
    const saved = conversation.agentSession
    if (saved?.agent === agentSession?.agent && saved?.id === agentSession?.id) return
    current.value = agentSession
      ? { ...conversation, agentSession }
      : omit(conversation, ['agentSession'])
    void flush().catch(() => undefined)
  }

  function ensureChat() {
    return serialize(async () => {
      if (readOnly.value && owner?.deref() === runtime.getEditor()) return null
      await loadDocument()
      const resume = resumableSession(current.value)
      if (chatEnded.value) await detach()
      if (!session.chat && agentReadOnly.value) return null
      const editor = runtime.getEditor()
      const conversation = current.value
      // Only a session that sees the whole conversation is saved to continue it.
      const recordsFor =
        conversation && (resume !== null || !messages.value.length) ? conversation.id : null
      const next = await runtime.ensureChat(messages.value, conversation?.id, {
        resume,
        record: (agentSession) => {
          if (recordsFor !== null) recordAgentSession(recordsFor, agentSession)
          // The resume failed; the conversation turns read-only once its failure is shown.
          if (agentSession === null && conversation?.id === current.value?.id)
            chatEnded.value = true
        }
      })
      if (runtime.getEditor() !== editor) {
        await next?.stop()
        await runtime.resetChat()
        return null
      }
      if (!next) return null
      session.attach(next, flush)
      // A session that missed what this chat adds must not be continued; kept until the chat starts.
      if (conversation?.agentSession && resume === null) recordAgentSession(conversation.id, null)
      return next
    })
  }

  function initialize() {
    return serialize(loadDocument)
  }
  function newChat() {
    return serialize(async () => {
      await detach()
      await createDraft()
    })
  }
  function open(id: string) {
    return serialize(async () => {
      if (current.value?.id === id) return
      await detach()
      const conversation = await store.read(id)
      if (conversation) await activate(conversation)
    })
  }
  function rename(id: string, title: string) {
    return serialize(async () => {
      if (current.value?.id === id && current.value.messages.length === 0 && title.trim()) {
        current.value = { ...current.value, title: title.trim(), titleSource: 'manual' }
        await flush()
      }
      await store.rename(id, title)
      if (current.value?.id === id && title.trim())
        current.value = { ...current.value, title: title.trim(), titleSource: 'manual' }
      await refresh()
    })
  }
  function remove(id: string) {
    return serialize(async () => {
      if (current.value?.id === id) {
        await detach()
        current.value = null
        messages.value = []
      }
      await store.remove(id)
      if (!current.value) await createDraft()
      await refresh()
    })
  }

  return {
    current,
    messages,
    conversations,
    readOnly,
    continuesAgentSession,
    agentReadOnly,
    chatEnded,
    busy,
    storageError,
    initialize,
    ensureChat,
    flush,
    newChat,
    open,
    rename,
    remove
  }
}
