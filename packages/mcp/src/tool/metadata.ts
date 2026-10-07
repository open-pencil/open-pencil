import * as v from 'valibot'

import type { ToolCapability } from '@open-pencil/core/tools'
export type { ToolCapability } from '@open-pencil/core/tools'

const TOOL_EFFECTS = ['read', 'write'] as const
const TOOL_AVAILABILITIES = ['default', 'eval', 'filesystem'] as const
const TOOL_CAPABILITIES = [
  'document:read',
  'document:write',
  'filesystem:read',
  'filesystem:write',
  'network:access',
  'code:execute',
  'settings:read',
  'settings:write'
] as const satisfies readonly ToolCapability[]

export type ToolEffect = (typeof TOOL_EFFECTS)[number]
export type ToolAvailability = (typeof TOOL_AVAILABILITIES)[number]

const toolDescriptorSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  description: v.string(),
  effect: v.picklist(TOOL_EFFECTS),
  availability: v.picklist(TOOL_AVAILABILITIES),
  capabilities: v.array(v.picklist(TOOL_CAPABILITIES)),
  enabled: v.boolean()
})

export type ToolDescriptor = v.InferOutput<typeof toolDescriptorSchema>

export interface ToolPolicy {
  allowEval: boolean
  disabledTools: string[]
}

export function parseToolDescriptor(value: unknown): ToolDescriptor | null {
  const parsed = v.safeParse(toolDescriptorSchema, value)
  return parsed.success ? parsed.output : null
}
