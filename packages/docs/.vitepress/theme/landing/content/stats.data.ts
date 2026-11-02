import { COMMANDS } from '@lawha/cli/commands'
import { ALL_TOOLS, isToolExposed } from '@lawha/core/tools'

export interface LandingStats {
  /** Top-level `lawha` commands, in alphabetical order. */
  cliCommands: string[]
  /** Tools the MCP server exposes. */
  mcpTools: number
}

declare const data: LandingStats
export { data }

/** Counted from the source at build time, so the page cannot drift from the product. */
export default {
  load(): LandingStats {
    return {
      cliCommands: Object.keys(COMMANDS).toSorted(),
      mcpTools: ALL_TOOLS.filter((tool) => isToolExposed(tool, 'mcp')).length
    }
  }
}
