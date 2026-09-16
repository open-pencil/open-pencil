import * as v from 'valibot'

export const DEFAULT_AGENT_STEPS = 50
export const AGENT_STEP_LIMIT_MIN = 1
export const AGENT_STEP_LIMIT_MAX = 1000

export const agentStepLimitSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(AGENT_STEP_LIMIT_MIN),
  v.maxValue(AGENT_STEP_LIMIT_MAX)
)

export function resolveAgentStepLimit(value: unknown): number {
  const result = v.safeParse(agentStepLimitSchema, value)
  return result.success ? result.output : DEFAULT_AGENT_STEPS
}
