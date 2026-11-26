import { onMounted } from 'vue'

import { acpAgentFor } from '@open-pencil/core/constants'
import { useMessages } from '@open-pencil/vue/i18n'

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

/** What `/` and `@` offer in a message field. */
export function useComposerCompletions() {
  const ai = useMessages('ai')
  const { providerID } = useAIChat()

  // Skills installed since the app started are offered without opening Settings first.
  onMounted(() => void refreshSkills())

  const sections = (): ComposerSections => ({
    node: ai.value.chatReferenceLayers,
    page: ai.value.chatReferencePages,
    skill: ai.value.chatReferenceSkills,
    command: ai.value.chatReferenceCommands
  })

  /**
   * The chat's `/review`, then an ACP agent's own commands, or else the chat's `/compact` and the
   * user's skills. `/review` asks the Review model whatever holds the chat, so it stands in for
   * an agent's own command of that name.
   */
  function commands(): CommandCandidate[] {
    const review = { name: 'review', description: ai.value.reviewCommand, hint: null }
    const agentId = acpAgentFor(providerID.value)?.id
    if (agentId) {
      const own = (agentCommands.value[agentId] ?? []).filter(({ name }) => name !== review.name)
      return agentCommandCandidates([review, ...own])
    }
    const compact = { name: 'compact', description: ai.value.compactCommand, hint: null }
    return chatCommandCandidates([review, compact], enabledSkills.value)
  }

  /** The active document's layers and pages matching `query`, then the user's skills. */
  function references(query: string): ReferenceCandidate[] {
    const store = getActiveEditorStoreOrNull()
    if (!store) return []
    return referenceCandidates(store.graph, store.state.currentPageId, enabledSkills.value, query)
  }

  return [commandCompletion(commands, sections), referenceCompletion(references, sections)]
}
