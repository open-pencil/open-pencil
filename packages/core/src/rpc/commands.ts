import {
  findCommand,
  infoCommand,
  nodeCommand,
  pagesCommand,
  queryCommand,
  treeCommand
} from './read-commands'
import {
  analyzeClustersCommand,
  analyzeColorsCommand,
  analyzeSpacingCommand,
  analyzeTypographyCommand
} from './analyze-commands'
import { variablesCommand } from './variables-command'

import type { SceneGraph } from '#core/scene-graph'
import type { RpcCommand } from './types'

export type { RpcCommand } from './types'
export * from './read-commands'
export * from './variables-command'
export * from './analyze-commands'

export const ALL_RPC_COMMANDS = [
  infoCommand,
  pagesCommand,
  treeCommand,
  findCommand,
  queryCommand,
  nodeCommand,
  variablesCommand,
  analyzeColorsCommand,
  analyzeTypographyCommand,
  analyzeSpacingCommand,
  analyzeClustersCommand
] as RpcCommand[]

export function executeRpcCommand(graph: SceneGraph, name: string, args: unknown): unknown {
  const cmd = ALL_RPC_COMMANDS.find((c) => c.name === name)
  if (!cmd) throw new Error(`Unknown command: ${name}`)
  return cmd.execute(graph, args as never)
}
