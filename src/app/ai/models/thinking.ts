import { THINKING_LEVELS, type ThinkingLevel } from '@/app/ai/models/types'

const LABEL_KEYS = {
  default: 'thinkingDefault',
  off: 'thinkingOff',
  minimal: 'thinkingMinimal',
  low: 'thinkingLow',
  medium: 'thinkingMedium',
  high: 'thinkingHigh',
  xhigh: 'thinkingExtraHigh'
} as const satisfies Record<ThinkingLevel, string>

export type ThinkingLevelLabels = Record<(typeof LABEL_KEYS)[ThinkingLevel], string>

export function thinkingLevelLabel(level: ThinkingLevel, labels: ThinkingLevelLabels): string {
  return labels[LABEL_KEYS[level]]
}

export function thinkingLevelOptions(labels: ThinkingLevelLabels) {
  return THINKING_LEVELS.map((value) => ({ value, label: thinkingLevelLabel(value, labels) }))
}

/** ACP agents choose their own reasoning; API models and Pi accept a level. */
export function supportsThinkingLevel(providerID: string): boolean {
  return !providerID.startsWith('acp:')
}
