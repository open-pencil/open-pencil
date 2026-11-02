import type { ToolDef } from '#core/tools/schema'

import { CORE_TOOLS } from './core'
import { EXTENDED_TOOLS } from './extended'

export { CORE_TOOLS } from './core'
export { EXTENDED_TOOLS } from './extended'

/** All tools combined — used by MCP server and CLI. */
export const ALL_TOOLS: ToolDef[] = [...CORE_TOOLS, ...EXTENDED_TOOLS]
