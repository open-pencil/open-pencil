import { executeRPCCommand } from '@open-pencil/core/rpc'

import { isAppMode, requireFile, rpc } from '#cli/app-client'
import { appTargetRPCArgs, type AppTargetCLIArgs } from '#cli/app-target'
import { loadDocument, prepareDocumentForRPC } from '#cli/headless'

type RPCArgs = { [key: string]: unknown }

function isRPCArgs(value: unknown): value is RPCArgs {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export async function loadRPCData<Result>(
  file: string | undefined,
  command: string,
  args?: unknown,
  targetArgs?: AppTargetCLIArgs
): Promise<Result> {
  if (isAppMode(file)) {
    return rpc<Result>(command, {
      ...(isRPCArgs(args) ? args : {}),
      ...(targetArgs ? appTargetRPCArgs(targetArgs) : {})
    })
  }
  const graph = await loadDocument(requireFile(file))
  prepareDocumentForRPC(graph, command, args)
  return executeRPCCommand(graph, command, args) as Result
}
