import { CORE_TOOLS } from './registry-core'
import { EXTENDED_TOOLS } from './registry-extended'
import type { ToolDef } from './schema'

export { CORE_TOOLS } from './registry-core'
export { EXTENDED_TOOLS } from './registry-extended'

/** All tools combined — used by MCP server and CLI. */
export const ALL_TOOLS: ToolDef[] = [...CORE_TOOLS, ...EXTENDED_TOOLS]
