import type { ToolDef } from '@open-pencil/core/tools'
import { ALL_TOOLS, toolChangesDocument, isToolExposed } from '@open-pencil/core/tools'

import type {
  ToolAvailability,
  ToolCapability,
  ToolDescriptor,
  ToolEffect
} from '#mcp/tool/metadata'

export function coreToolEffect(def: ToolDef): ToolEffect {
  return toolChangesDocument(def) ? 'write' : 'read'
}

export function coreToolCapabilities(def: ToolDef): ToolCapability[] {
  return [...def.capabilities]
}

export function coreToolAvailability(def: ToolDef): ToolAvailability {
  return def.availability
}

function coreToolDescriptor(def: ToolDef): ToolDescriptor {
  return {
    name: def.name,
    description: def.description,
    effect: coreToolEffect(def),
    availability: coreToolAvailability(def),
    capabilities: coreToolCapabilities(def),
    enabled: true
  }
}

export function getMCPToolDefinitions() {
  return ALL_TOOLS.filter((def) => isToolExposed(def, 'mcp'))
}

export function createToolDescriptors(filesystemEnabled: boolean): ToolDescriptor[] {
  const descriptors = getMCPToolDefinitions().map(coreToolDescriptor)
  descriptors.push(
    {
      name: 'list_documents',
      description:
        'List open OpenPencil documents/tabs with their IDs, file paths, current pages, and pages.',
      effect: 'read',
      availability: 'default',
      capabilities: ['document:read'],
      enabled: true
    },
    {
      name: 'save_file',
      description:
        'Save the current document to disk. An optional path must stay inside the configured MCP root.',
      effect: 'write',
      availability: 'default',
      capabilities: ['document:read', 'filesystem:write'],
      enabled: true
    },
    ...(filesystemEnabled
      ? [
          {
            name: 'open_file',
            description: 'Open a .fig or .pen file from inside the configured MCP root.',
            effect: 'read',
            availability: 'filesystem',
            capabilities: ['filesystem:read', 'document:read'],
            enabled: true
          } satisfies ToolDescriptor,
          {
            name: 'new_document',
            description:
              'Create a new empty document with an optional save path inside the configured MCP root.',
            effect: 'write',
            availability: 'filesystem',
            capabilities: ['document:write', 'filesystem:write'],
            enabled: true
          } satisfies ToolDescriptor
        ]
      : []),
    {
      name: 'close_file',
      description: 'Close an open document tab, prompting to save unsaved changes.',
      effect: 'read',
      availability: 'default',
      capabilities: ['document:read'],
      enabled: true
    },
    {
      name: 'get_codegen_prompt',
      description:
        'Get design-to-code generation guidelines. Call before generating frontend code.',
      effect: 'read',
      availability: 'default',
      capabilities: [],
      enabled: true
    }
  )
  return descriptors
}
