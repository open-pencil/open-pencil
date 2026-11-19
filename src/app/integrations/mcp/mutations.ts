import { createMutex, type Mutex } from '@open-pencil/std/async'

import type { MCPConnectionID } from './types'

// Domain-owned: pending operations survive disposal of a Settings editor.
const mutexByConnection = new Map<MCPConnectionID, Mutex>()

export function enqueueMCPConnectionMutation<T>(
  id: MCPConnectionID,
  operation: () => Promise<T>
): Promise<T> {
  let mutex = mutexByConnection.get(id)
  if (!mutex) {
    mutex = createMutex()
    mutexByConnection.set(id, mutex)
  }
  return mutex.run(operation)
}
