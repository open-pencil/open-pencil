import { useI18n } from '@open-pencil/vue'

import type { SetupProblem } from '@/app/ai/agents/setup'

/** The warning setup shows for a problem it cannot fix on its own. */
export function useSetupProblemMessage() {
  const { ai } = useI18n()
  return (problem: SetupProblem | null): string | null => {
    if (problem === 'needs-npm') return ai.value.aiSetupAgentNeedsNpm
    if (problem === 'install-failed') return ai.value.aiSetupAgentInstallFailed
    if (problem === 'mcp-start-failed') return ai.value.aiSetupAgentMCPStartFailed
    if (problem === 'lookup-failed') return ai.value.aiSetupAgentLookupFailed
    return null
  }
}
