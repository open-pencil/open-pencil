import type {
  HarnessAdapterID,
  HarnessProviderCapability,
  HarnessSessionConfiguration,
  HarnessTurnUsage,
  JSONValue
} from '../protocol'

export type HarnessResumeState = {
  type: 'resume-session'
  harnessId: string
  specificationVersion: 'harness-v1'
  data: JSONValue
  continueFrom?: JSONValue
}

export interface BackendSession {
  readonly sessionId: string
  readonly isResume: boolean
  runTurn(prompt: string, signal?: AbortSignal): AsyncIterable<BackendEvent>
  stop(): Promise<HarnessResumeState>
  destroy(): Promise<void>
}

export type BackendEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: JSONValue }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: JSONValue }
  | { type: 'finish'; finishReason: string; usage?: HarnessTurnUsage }
  | { type: 'error'; message: string }

export interface HarnessBackend {
  readonly id: HarnessAdapterID
  readonly capabilities: HarnessProviderCapability
  createSession(options: {
    sessionId: string
    resumeState?: HarnessResumeState
    configuration?: HarnessSessionConfiguration
    signal?: AbortSignal
  }): Promise<BackendSession>
}
