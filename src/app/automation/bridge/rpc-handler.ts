import { executeRpcCommand } from '@open-pencil/core/rpc'

import type { EditorStore } from '@/app/editor/active-store'

export async function handleRpcFallback(
  store: EditorStore,
  command: string,
  args: unknown
): Promise<unknown> {
  const result = executeRpcCommand(store.graph, command, args ?? {})
  return { ok: true, result }
}
