import { executeRPCCommand } from '@open-pencil/core/rpc'

import type { AutomationTarget } from '@/app/automation/bridge/target'

export async function handleRPCFallback(
  target: AutomationTarget,
  command: string,
  args: unknown
): Promise<unknown> {
  const result = executeRPCCommand(target.store.graph, command, args ?? {})
  return { ok: true, result }
}
