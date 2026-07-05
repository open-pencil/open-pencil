import { executeRpcCommand } from '@open-pencil/core/rpc'

import { isAppMode, requireFile, rpc } from '#cli/app-client'
import { appTargetRpcArgs, type AppTargetCliArgs } from '#cli/app-target'
import { loadDocument } from '#cli/headless'

type RpcArgs = { [key: string]: unknown }

function isRpcArgs(value: unknown): value is RpcArgs {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export async function loadRpcData<Result>(
  file: string | undefined,
  command: string,
  args?: unknown,
  targetArgs?: AppTargetCliArgs
): Promise<Result> {
  if (isAppMode(file)) {
    return rpc<Result>(command, {
      ...(isRpcArgs(args) ? args : {}),
      ...(targetArgs ? appTargetRpcArgs(targetArgs) : {})
    })
  }
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, command, args) as Result
}
