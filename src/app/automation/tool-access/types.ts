import type { ToolDescriptor } from '@lawha/mcp/tools'

/** The presentation contract shared by local AI and discovered MCP tools. */
export type ToolAccessEntry = Pick<ToolDescriptor, 'name' | 'description' | 'effect'>

export type ToolAccessTarget = 'ai' | 'mcp'
