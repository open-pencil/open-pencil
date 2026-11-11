import { executeRPCCommand } from '@open-pencil/core/rpc'

import { isAppMode, requireFile, rpc } from '#cli/app/client'
import { appPageTargetRPCArgs, requestedPage, type PageCLIArgs } from '#cli/app/target'
import { loadDocument, prepareDocumentForRPC } from '#cli/headless'

type RPCArgs = { [key: string]: unknown }

function isRPCArgs(value: unknown): value is RPCArgs {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * Runs an RPC command against the running app or a document file. The page `--page` or
 * `--page-id` names in `targetArgs` reaches the command as its `page_id` or `page` argument.
 */
export async function loadRPCData<Result>(
  file: string | undefined,
  command: string,
  args?: unknown,
  targetArgs?: PageCLIArgs
): Promise<Result> {
  const rpcArgs: RPCArgs = isRPCArgs(args) ? { ...args } : {}
  if (isAppMode(file)) {
    if (targetArgs) Object.assign(rpcArgs, await appPageTargetRPCArgs(targetArgs))
    return rpc<Result>(command, rpcArgs)
  }
  const page = targetArgs ? requestedPage(targetArgs) : undefined
  if (page) Object.assign(rpcArgs, 'id' in page ? { page_id: page.id } : { page: page.name })
  const graph = await loadDocument(requireFile(file))
  prepareDocumentForRPC(graph, command, rpcArgs)
  return executeRPCCommand(graph, command, rpcArgs) as Result
}
