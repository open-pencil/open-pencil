import { ALL_TOOLS } from '@open-pencil/core/tools'

export type MCPToolRequirement = 'always' | 'eval' | 'root'

export type MCPToolCatalogEntry = {
  name: string
  description: string
  requirement: MCPToolRequirement
}

export const MCP_ONLY_TOOLS = {
  listDocuments: {
    name: 'list_documents',
    description: 'List open OpenPencil documents/tabs and recently opened files available to open.',
    requirement: 'always'
  },
  saveFile: {
    name: 'save_file',
    description: 'Save the current document to disk.',
    requirement: 'always'
  },
  openFile: {
    name: 'open_file',
    description: 'Open a .fig or .pen file from disk into a new tab.',
    requirement: 'root'
  },
  newDocument: {
    name: 'new_document',
    description: 'Create a new empty document.',
    requirement: 'root'
  },
  getCodegenPrompt: {
    name: 'get_codegen_prompt',
    description: 'Get design-to-code generation guidelines. Call before generating frontend code.',
    requirement: 'always'
  }
} as const satisfies Record<string, MCPToolCatalogEntry>

export const MCP_TOOL_CATALOG: MCPToolCatalogEntry[] = [
  ...ALL_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    requirement: tool.name === 'eval' ? ('eval' as const) : ('always' as const)
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
