import type { Ref } from 'vue'

import { AgentSetupError, type AgentSetupProblem } from '@/app/ai/agents/readiness'
import { VisionModelUnavailableError } from '@/app/ai/attachment/image/analyze'

export interface SubmissionMessages {
  openSettings: string
  requestFailed: string
  visionUnavailable: string
  runSetup: string
  agentSetup: Record<AgentSetupProblem, string>
}

export interface SubmissionErrorOptions {
  messages: Ref<SubmissionMessages>
  reportError: (message: string, action?: { label: string; run: () => void }) => void
  openModelSettings: () => void
  openSetup: () => void
}

/** Explains why a message could not be sent, with the fix when there is one. */
export function reportSubmissionError(options: SubmissionErrorOptions, error: unknown): void {
  console.error('Chat error:', error)
  if (error instanceof AgentSetupError) {
    options.reportError(options.messages.value.agentSetup[error.problem], {
      label: options.messages.value.runSetup,
      run: options.openSetup
    })
    return
  }
  if (error instanceof VisionModelUnavailableError) {
    options.reportError(options.messages.value.visionUnavailable, {
      label: options.messages.value.openSettings,
      run: options.openModelSettings
    })
    return
  }
  options.reportError(options.messages.value.requestFailed)
}
