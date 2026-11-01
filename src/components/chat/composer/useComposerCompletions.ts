import { onMounted } from 'vue'

import { useAIMessages } from '@open-pencil/vue/i18n'

import { agentCommands } from '@/app/ai/agents/acp/commands'
import { commandCandidates, referenceCandidates } from '@/app/ai/chat/references/candidates'
import { useAIChat } from '@/app/ai/chat/use'
import { enabledSkills, refreshSkills } from '@/app/ai/skills/library'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'

import { commandCompletion, referenceCompletion } from './complete'

/**
 * What `/` and `@` offer in a message field. An ACP agent runs its own skills and commands; the
 * built-in chat and Pi run the user's skills.
 */
export function useComposerCompletions() {
  const ai = useAIMessages()
  const { providerID } = useAIChat()

  function acpAgentId(): string | null {
    return providerID.value.startsWith('acp:') ? providerID.value.slice('acp:'.length) : null
  }
  const sections = () => ({
    node: ai.value.chatReferenceLayers,
    page: ai.value.chatReferencePages,
    skill: ai.value.chatReferenceSkills,
    command: ai.value.chatReferenceCommands
  })

  // Skills installed since the app started are offered without opening Settings first.
  onMounted(() => void refreshSkills())

  return [
    commandCompletion(() => {
      const agentId = acpAgentId()
      return commandCandidates(
        agentId ? (agentCommands.value[agentId] ?? []) : null,
        enabledSkills.value
      )
    }, sections),
    referenceCompletion((query) => {
      const store = getActiveEditorStoreOrNull()
      if (!store) return []
      return referenceCandidates(store.graph, store.state.currentPageId, enabledSkills.value, query)
    }, sections)
  ]
}
