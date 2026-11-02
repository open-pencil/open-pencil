import { onMounted } from 'vue'

import { useAIMessages } from '@open-pencil/vue/i18n'

import { agentCommands } from '@/app/ai/agents/acp/commands'
import {
  agentCommandCandidates,
  chatCommandCandidates,
  referenceCandidates,
  type CommandCandidate,
  type ReferenceCandidate
} from '@/app/ai/chat/references/candidates'
import { useAIChat } from '@/app/ai/chat/use'
import { enabledSkills, refreshSkills } from '@/app/ai/skills/library'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'

import { commandCompletion, referenceCompletion, type ComposerSections } from './complete'

/** The ACP agent a provider ID names, or null for the built-in chat and Pi. */
function acpAgentId(providerID: string): string | null {
  return providerID.startsWith('acp:') ? providerID.slice('acp:'.length) : null
}

/** What `/` and `@` offer in a message field. */
export function useComposerCompletions() {
  const ai = useAIMessages()
  const { providerID } = useAIChat()

  // Skills installed since the app started are offered without opening Settings first.
  onMounted(() => void refreshSkills())

  const sections = (): ComposerSections => ({
    node: ai.value.chatReferenceLayers,
    page: ai.value.chatReferencePages,
    skill: ai.value.chatReferenceSkills,
    command: ai.value.chatReferenceCommands
  })

  /** An ACP agent's own commands, or else the chat's `/compact` and the user's skills. */
  function commands(): CommandCandidate[] {
    const agentId = acpAgentId(providerID.value)
    if (agentId) return agentCommandCandidates(agentCommands.value[agentId] ?? [])
    const compact = { name: 'compact', description: ai.value.compactCommand, hint: null }
    return chatCommandCandidates([compact], enabledSkills.value)
  }

  /** The active document's layers and pages matching `query`, then the user's skills. */
  function references(query: string): ReferenceCandidate[] {
    const store = getActiveEditorStoreOrNull()
    if (!store) return []
    return referenceCandidates(store.graph, store.state.currentPageId, enabledSkills.value, query)
  }

  return [commandCompletion(commands, sections), referenceCompletion(references, sections)]
}
