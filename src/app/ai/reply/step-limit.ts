import * as v from 'valibot'

import { agentStepLimitSchema } from './schema'

export const DEFAULT_AGENT_STEPS = 50

export function resolveAgentStepLimit(value: unknown): number {
  const result = v.safeParse(agentStepLimitSchema, value)
  return result.success ? result.output : DEFAULT_AGENT_STEPS
}
