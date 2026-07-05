import { executeRpcCommand } from '@open-pencil/core/rpc'

import type { AutomationTarget } from '@/app/automation/bridge/target'

export async function handleRpcFallback(
  target: AutomationTarget,
  command: string,
  args: unknown
): Promise<unknown> {
  const result = executeRpcCommand(target.store.graph, command, args ?? {})
  return { ok: true, result }
}
