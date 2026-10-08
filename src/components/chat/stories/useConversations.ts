import { computed, ref } from 'vue'

import { conversations, profileOptions } from './fixtures'
import { useAttachments } from './useAttachments'

export function useConversations(initialChat: string) {
  const chats = ref(conversations())
  const selectedId = ref(initialChat)
  const selected = computed(() => chats.value.find((chat) => chat.id === selectedId.value))
  const options = computed(() => chats.value.map((chat) => ({ value: chat.id, label: chat.title })))
  const hasSavedConversation = computed(() => Boolean(selected.value?.messages.length))
  const conversationOptions = computed(() =>
    chats.value.map((chat) => ({
      id: chat.id,
      title: chat.title,
      documentName: 'Demo document',
      available: true
    }))
  )
  function selectConversation(id: string) {
    selectedId.value = id
  }
  function copyDiagnostics() {
    notice.value = 'Diagnostic copying is mocked in this story.'
  }
  function showProfileNotice() {
    notice.value = 'These are mock profiles. Provider settings are unchanged.'
  }
  const profile = ref('balanced')
  const presentations = useAttachments()

  const notice = ref('')
  function newChat() {
    const id = crypto.randomUUID()
    chats.value.push({ id, title: 'New chat', status: 'ready', messages: [] })
    selectedId.value = id
  }
  function removeChat() {
    chats.value = chats.value.filter((chat) => chat.id !== selectedId.value)
    const first = chats.value.at(0)
    if (first) selectedId.value = first.id
    else newChat()
  }
  function renameChat(id: string, title: string) {
    const chat = chats.value.find((chat) => chat.id === id)
    if (chat) chat.title = title
  }
  const PREVIEW_REPLY =
    'This is a **local preview response**. No model was called and no document was changed.'
  function submit(text: string) {
    const chat = selected.value
    if (!chat) return
    if (!chat.messages.length && chat.title === 'New chat') chat.title = text
    chat.messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text }]
    })
    chat.messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: PREVIEW_REPLY
        }
      ]
    })
    chat.status = 'ready'
  }
  function regenerate() {
    const reply = selected.value?.messages.findLast((message) => message.role === 'assistant')
    if (!reply) return
    reply.parts = [{ type: 'text', text: `${PREVIEW_REPLY} (regenerated)` }]
  }
  function resend(messageId: string, text: string) {
    const chat = selected.value
    const index = chat?.messages.findIndex((message) => message.id === messageId) ?? -1
    if (!chat || index === -1) return
    chat.messages.splice(index)
    submit(text)
  }
  function stop() {
    const chat = selected.value
    if (!chat) return
    chat.status = 'ready'
    for (const message of chat.messages) {
      message.parts = message.parts.map((part) => {
        if (part.type === 'reasoning') return { ...part, state: 'done' }
        if ('toolCallId' in part && part.state === 'input-available')
          return { ...part, state: 'output-error', errorText: 'Stopped in the story.' }
        return part
      })
    }
  }
  return {
    chats,
    renameChat,
    profileOptions,
    hasSavedConversation,
    conversationOptions,
    selectConversation,
    copyDiagnostics,
    showProfileNotice,
    selectedId,
    selected,
    options,
    presentations,
    profile,
    notice,
    newChat,
    removeChat,
    submit,
    regenerate,
    resend,
    stop
  }
}
