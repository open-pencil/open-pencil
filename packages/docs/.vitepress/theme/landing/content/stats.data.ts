import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import { ALL_TOOLS, isToolExposed } from '@open-pencil/core/tools'

export interface LandingStats {
  /** Top-level `openpencil` commands, in the order `--help` lists them. */
  cliCommands: string[]
  /** Tools the MCP server exposes. */
  mcpTools: number
  /** Tools the built-in AI agent can call. */
  aiTools: number
}

declare const data: LandingStats
export { data }

/** One module per top-level command, as `packages/cli/src/index.ts` registers them. */
const commandsDir = new URL(
  'src/commands/',
  pathToFileURL(createRequire(import.meta.url).resolve('@open-pencil/cli/package.json'))
)

/** Counted from the source at build time, so the page cannot drift from the product. */
export default {
  load(): LandingStats {
    return {
      cliCommands: readdirSync(commandsDir)
        .map((entry) => entry.replace(/\.ts$/, ''))
        .sort(),
      mcpTools: ALL_TOOLS.filter((tool) => isToolExposed(tool, 'mcp')).length,
      aiTools: ALL_TOOLS.filter((tool) => isToolExposed(tool, 'ai')).length
    }
  }
}
