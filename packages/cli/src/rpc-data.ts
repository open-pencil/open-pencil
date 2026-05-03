import { isAppMode, requireFile, rpc } from '#cli/app-client'
import { loadDocument } from '#cli/headless'

import { executeRpcCommand } from '@open-pencil/core/rpc'

export async function loadRpcData<Result>(
  file: string | undefined,
  command: string,
  args?: unknown
): Promise<Result> {
  if (isAppMode(file)) return rpc<Result>(command, args)
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, command, args) as Result
}
