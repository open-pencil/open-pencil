import type { GUID } from './types'

/** Figma's plugin-facing variable id, as `VariableID:<session>:<local>`. */
export function parseVariableId(variableId: string): GUID | null {
  const match = variableId.match(/VariableID:(\d+):(\d+)/)
  if (!match) return null
  return {
    sessionID: Number.parseInt(match[1] ?? '0', 10),
    localID: Number.parseInt(match[2] ?? '0', 10)
  }
}
