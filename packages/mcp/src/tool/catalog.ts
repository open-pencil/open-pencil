import type { DocumentAccess } from '@open-pencil/core/tools'

export type MCPToolAvailability = 'default' | 'eval' | 'filesystem'

export type MCPToolCatalogEntry = {
  name: string
  description: string
  availability: MCPToolAvailability
  documentAccess: DocumentAccess
}

export function parseDisabledTools(value: string | undefined): string[] {
  if (!value) return []
  return [
    ...new Set(
      value
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ]
}
