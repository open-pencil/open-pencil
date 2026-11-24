import { useMessages } from '@open-pencil/vue/i18n'

import type { SetupProblem } from '@/app/ai/agents/setup/view'

/** The warning setup shows for a problem it cannot fix on its own. */
export function useSetupProblemMessage() {
  const ai = useMessages('ai')
  return (problem: SetupProblem | null): string | null => {
    if (problem === 'needs-npm') return ai.value.aiSetupAgentNeedsNpm
    if (problem === 'needs-admin') return ai.value.aiSetupAgentNeedsAdmin
    if (problem === 'install-failed') return ai.value.aiSetupAgentInstallFailed
    if (problem === 'mcp-start-failed') return ai.value.aiSetupAgentMCPStartFailed
    if (problem === 'lookup-failed') return ai.value.aiSetupAgentLookupFailed
    return null
  }
}
