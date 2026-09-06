import type { MCPConnectionID } from './types'

// Domain-owned: pending operations survive disposal of a Settings editor.
const pendingByConnection = new Map<MCPConnectionID, Promise<unknown>>()

export function enqueueMCPConnectionMutation<T>(
  id: MCPConnectionID,
  operation: () => Promise<T>
): Promise<T> {
  const previous = pendingByConnection.get(id) ?? Promise.resolve()
  const pending = previous.then(operation, operation)
  const settled = pending.then(
    () => undefined,
    () => undefined
  )
  pendingByConnection.set(id, settled)
  void settled.then(() => {
    if (pendingByConnection.get(id) === settled) pendingByConnection.delete(id)
    return undefined
  })
  return pending
}
