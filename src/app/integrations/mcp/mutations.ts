import { createKeyedMutex } from '@open-pencil/std/async'

import type { MCPConnectionID } from './types'

// Domain-owned: pending operations survive disposal of a Settings editor.
const mutations = createKeyedMutex<MCPConnectionID>()

export function enqueueMCPConnectionMutation<T>(
  id: MCPConnectionID,
  operation: () => Promise<T>
): Promise<T> {
  return mutations.run(id, operation)
}
