import type { ToolDescriptor } from '@open-pencil/mcp/tools'

/** The presentation contract shared by local AI and discovered MCP tools. */
export type ToolAccessEntry = Pick<ToolDescriptor, 'name' | 'description' | 'effect'>

export type ToolAccessTarget = 'ai' | 'mcp'

/** One catalog group as presented to the settings UI, including its translated label. */
export type ToolAccessGroup = {
  effect: ToolAccessEntry['effect']
  label: string
  enabled: boolean
  state: 'mixed' | 'idle'
  tools: ToolAccessEntry[]
}
