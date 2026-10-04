import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'

import type { AttachmentPresentation } from '@/app/ai/attachment/presentation/types'
import type { ToolChange } from '@/app/ai/tools/changes/types'

import type { ChatDocumentEditor } from './document'

export type HistoryChat = Pick<Chat<UIMessage>, 'messages' | 'status' | 'stop'>

export interface HistoryRuntime<TChat extends HistoryChat> {
  getEditor(): ChatDocumentEditor
  ensureChat(messages?: UIMessage[], sessionId?: string): Promise<TChat | null>
  resetChat(): Promise<void>
  backend(): ConversationMeta['backend']
  profileId(): string | null
}

export interface ConversationMeta {
  id: string
  documentId: string
  documentName: string
  title: string
  titleSource: 'fallback' | 'manual' | 'generated'
  createdAt: string
  updatedAt: string
  profileId: string | null
  backend: 'direct' | 'acp' | 'harness'
  interrupted: boolean
}

export interface ConversationMessage {
  message: UIMessage
  displayText?: string
  attachments: AttachmentPresentation[]
  /** Absent in conversations saved before changes were recorded. */
  toolChanges?: ToolChange[]
}

export interface Conversation extends ConversationMeta {
  messages: ConversationMessage[]
}

export interface ConversationStore {
  list(documentId?: string): Promise<ConversationMeta[]>
  read(id: string): Promise<Conversation | null>
  write(conversation: Conversation): Promise<void>
  rename(id: string, title: string): Promise<void>
  remove(id: string): Promise<void>
  resolveFile(handle: FileSystemFileHandle): Promise<string>
  reassignDocument(from: string, to: string, name: string): Promise<void>
  getSelected(documentId: string): Promise<string | null>
  select(documentId: string, id: string): Promise<void>
}
