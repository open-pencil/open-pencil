import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  analyzeClustersCommand,
  analyzeColorsCommand,
  analyzeOverlapsCommand,
  analyzeSpacingCommand,
  analyzeTypographyCommand
} from './analyze-commands'
import {
  findCommand,
  fontStatusCommand,
  infoCommand,
  nodeCommand,
  pagesCommand,
  queryCommand,
  treeCommand
} from './read-commands'
import type { RPCCommand } from './types'
import { variablesCommand } from './variables-command'

export type AutomationDocumentSummary = {
  id: string
  name: string
  path?: string
  active: boolean
  current_page_id: string
  current_page_name: string
  pages: Array<{ id: string; name: string }>
}

export type { RPCCommand } from './types'
export * from './read-commands'
export * from './variables-command'
export * from './analyze-commands'

export const ALL_RPC_COMMANDS = [
  infoCommand,
  fontStatusCommand,
  pagesCommand,
  treeCommand,
  findCommand,
  queryCommand,
  nodeCommand,
  variablesCommand,
  analyzeColorsCommand,
  analyzeTypographyCommand,
  analyzeSpacingCommand,
  analyzeClustersCommand,
  analyzeOverlapsCommand
] as RPCCommand[]

export function executeRPCCommand(graph: SceneGraph, name: string, args: unknown): unknown {
  const cmd = ALL_RPC_COMMANDS.find((c) => c.name === name)
  if (!cmd) throw new Error(`Unknown command: ${name}`)
  return cmd.execute(graph, args as never)
}
