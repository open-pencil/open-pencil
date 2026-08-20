import { ALL_TOOLS } from '@open-pencil/core/tools'
import type { DocumentAccess } from '@open-pencil/core/tools'

export type MCPToolAvailability = 'default' | 'eval' | 'filesystem'

export type MCPToolCatalogEntry = {
  name: string
  description: string
  availability: MCPToolAvailability
  documentAccess: DocumentAccess
}

export const MCP_ONLY_TOOLS = {
  listDocuments: {
    name: 'list_documents',
    description:
      'List open OpenPencil documents/tabs with their IDs, file paths, current pages, and pages.',
    availability: 'default',
    documentAccess: 'inspect'
  },
  saveFile: {
    name: 'save_file',
    description: 'Save the current document to disk.',
    availability: 'default',
    documentAccess: 'inspect'
  },
  openFile: {
    name: 'open_file',
    description: 'Open a .fig or .pen file from disk into a new tab.',
    availability: 'filesystem',
    documentAccess: 'inspect'
  },
  newDocument: {
    name: 'new_document',
    description: 'Create a new empty document.',
    availability: 'filesystem',
    documentAccess: 'modify'
  },
  getCodegenPrompt: {
    name: 'get_codegen_prompt',
    description: 'Get design-to-code generation guidelines. Call before generating frontend code.',
    availability: 'default',
    documentAccess: 'inspect'
  }
} as const satisfies Record<string, MCPToolCatalogEntry>

export const MCP_TOOL_CATALOG: MCPToolCatalogEntry[] = [
  ...ALL_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    availability: tool.name === 'eval' ? ('eval' as const) : ('default' as const),
    documentAccess: tool.documentAccess
  })),
  ...Object.values(MCP_ONLY_TOOLS)
]

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
