import type { UIMessage } from 'ai'
import { omit } from 'es-toolkit/object'

import { createTraceStore } from '@/app/ai/chat/history/idb'
import { snapshotMessages } from '@/app/ai/chat/history/messages'
import type { Conversation } from '@/app/ai/chat/history/types'
import { diagnostics } from '@/app/diagnostics'
import { diagnosticsEnvironment } from '@/app/diagnostics/environment'
import { getExportBytes, saveExportedFile } from '@/app/document/export/files'
import { downloadBlob } from '@/app/document/io/browser'

import type { TraceAsset, TraceStore } from './types'

export const CHAT_TRACE_FORMAT = 'openpencil-chat-trace'
export const CHAT_TRACE_VERSION = 2

/**
 * A conversation as it ran, to reproduce what the agent did: every message part (text,
 * reasoning, tool calls with their inputs and outputs), each run's steps with their model,
 * settings, usage, and errors, the instructions and tools they were given, and the
 * conversation's diagnostic events. A step's request is rebuilt from `messages` and checked
 * against its fingerprint by `./rebuild`.
 */
export async function chatTrace(
  conversation: Conversation,
  messages: UIMessage[],
  store: TraceStore = createTraceStore()
) {
  const runs = await store.listRuns(conversation.id)
  const hashes = new Set(
    runs.flatMap((run) => (run.tools ? [run.instructions, run.tools] : [run.instructions]))
  )
  const assets: Record<string, TraceAsset> = {}
  for (const hash of hashes) {
    const asset = await store.getAsset(hash)
    if (asset) assets[hash] = asset
  }
  const events = (await diagnostics.list()).filter((event) => event.sessionId === conversation.id)
  return JSON.stringify(
    {
      format: CHAT_TRACE_FORMAT,
      version: CHAT_TRACE_VERSION,
      environment: diagnosticsEnvironment(),
      conversation: omit(conversation, ['messages']),
      messages: snapshotMessages(messages),
      runs,
      assets,
      events: events.toReversed()
    },
    null,
    2
  )
}

/** Saves a conversation's trace where the person chooses; `false` means they cancelled. */
export async function saveChatTrace(conversation: Conversation, messages: UIMessage[]) {
  return saveExportedFile(
    getExportBytes(await chatTrace(conversation, messages)),
    `${conversation.title || 'Chat'} trace.json`,
    'JSON',
    '.json',
    'application/json',
    downloadBlob
  )
}
