import type { ToolDef } from '@open-pencil/core/tools'
import { ALL_TOOLS, toolChangesDocument } from '@open-pencil/core/tools'

import type {
  ToolAvailability,
  ToolCapability,
  ToolDescriptor,
  ToolEffect
} from '#mcp/tool/metadata'

const TOOL_CAPABILITY_OVERRIDES: Readonly<Partial<Record<string, readonly ToolCapability[]>>> = {
  eval: ['document:read', 'document:write', 'code:execute'],
  fetch_icons: ['network:access'],
  insert_icon: ['document:write', 'network:access'],
  list_available_fonts: ['document:read'],
  search_icons: ['network:access'],
  stock_photo: ['document:write', 'network:access']
}

export function coreToolEffect(def: ToolDef): ToolEffect {
  return toolChangesDocument(def) ? 'write' : 'read'
}

export function coreToolCapabilities(def: ToolDef): ToolCapability[] {
  const override = TOOL_CAPABILITY_OVERRIDES[def.name]
  return override ? [...override] : [toolChangesDocument(def) ? 'document:write' : 'document:read']
}

export function coreToolAvailability(def: ToolDef): ToolAvailability {
  return def.name === 'eval' ? 'eval' : 'default'
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

export function createToolDescriptors(filesystemEnabled: boolean): ToolDescriptor[] {
  const descriptors = ALL_TOOLS.map(coreToolDescriptor)
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
            effect: 'write',
            availability: 'filesystem',
            capabilities: ['filesystem:read', 'document:write'],
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
