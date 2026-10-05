import { describe, expect, mock, test } from 'bun:test'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import { ref, shallowRef } from 'vue'

import { AgentSetupError } from '@/app/ai/agents/readiness'
import { useChatSubmission } from '@/app/ai/chat/submission/use'
import type { EditorStore } from '@/app/editor/active-store'

const messages = ref({
  openSettings: 'Open settings',
  requestFailed: 'Request failed',
  visionUnavailable: 'Vision unavailable',
  runSetup: 'Run guided setup',
  agentSetup: {
    'companion-missing': 'Companion missing',
    'companion-outdated': 'Companion outdated',
    'mcp-outdated': 'MCP outdated',
    'pi-sign-in': 'Pi sign-in',
    'pi-model': 'Pi model'
  }
})

function submission(ensureChat: () => Promise<null>) {
  const reportError = mock(() => undefined)
  const openSetup = mock(() => undefined)
  const chat = useChatSubmission({
    chat: shallowRef<Chat<UIMessage> | null>(null),
    ensureChat,
    clearFailure: () => undefined,
    getEditor: () => ({}) as EditorStore,
    messages,
    reportError,
    openModelSettings: () => undefined,
    openSetup
  })
  return { chat, reportError, openSetup }
}

const message = { modelText: 'Draw a card', displayText: 'Draw a card', images: [], nodes: [] }

describe('useChatSubmission', () => {
  test('reports an unsent message so the composer can keep it', async () => {
    const { chat } = submission(async () => null)
    expect(await chat.submit(message)).toBe(false)
  })

  test('names the setup problem that stopped an agent chat and offers guided setup', async () => {
    const { chat, reportError, openSetup } = submission(async () => {
      throw new AgentSetupError('mcp-outdated')
    })
    expect(await chat.submit(message)).toBe(false)
    expect(reportError).toHaveBeenCalledWith('MCP outdated', {
      label: 'Run guided setup',
      run: openSetup
    })
  })
})
