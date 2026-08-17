export type FontResolutionState = 'idle' | 'loading' | 'loaded' | 'failed' | 'exhausted'

export type FontResolutionEvent = 'started' | 'settled' | 'reset'

export type FontResolutionListener = (
  event: FontResolutionEvent,
  snapshot: FontResolutionSnapshot
) => void

export type FontCandidateSource = 'registered' | 'local' | 'cache' | 'remote' | 'fallback'

export interface FontResolutionCandidate {
  id: string
  family: string
  style: string
  source: FontCandidateSource
}

export interface FontResolutionDemand {
  key: string
  candidates: readonly FontResolutionCandidate[]
  characters?: string
}

export interface FontResolutionSnapshot {
  key: string
  state: FontResolutionState
  candidate?: FontResolutionCandidate
  source?: FontCandidateSource
  error?: unknown
}

export type FontResolutionLoader = (
  candidate: FontResolutionCandidate,
  demand: FontResolutionDemand
) => Promise<boolean>

export type FontResolutionSettled = (
  snapshot: FontResolutionSnapshot,
  nodeIds: readonly string[]
) => void
