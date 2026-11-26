import type { ACPAgentID } from '@open-pencil/core/constants'

import type { PermissionNotice } from '@/app/tauri/host'
import { spawnAgentProcess, type AgentChild } from '@/app/ai/agents/process'

/** A started agent: its process, and the pipes the ACP connection reads and writes. */
export interface ACPProcess {
  child: AgentChild
  input: WritableStream<Uint8Array>
  output: ReadableStream<Uint8Array>
}

export type ACPProcessOptions = {
  agent: ACPAgentID
  /** Every permission request is refused without asking, for a connection in which nothing runs. */
  refusesTools?: boolean
  logId: string
  destroying: () => boolean
  onUnexpectedClose: () => void
  /** The agent waits on the person in the desktop app's permission window, or stopped waiting. */
  onPermission?: (event: PermissionNotice) => void
}

/**
 * Starts an ACP agent. The desktop app runs it in the agent workspace, answers its permission
 * requests itself or through its permission window, and pins the folder and options of the
 * sessions the chat opens (`desktop/src/host/acp.rs`).
 */
export async function spawnACPProcess({
  agent,
  refusesTools = false,
  logId,
  destroying,
  onUnexpectedClose,
  onPermission
}: ACPProcessOptions): Promise<ACPProcess> {
  const started = await spawnAgentProcess({
    program: { kind: 'agent', agent, refusesTools },
    onStderr: (text) => console.error(`[ACP ${logId}]`, text),
    // A connection still reading learns the agent is gone, unless it was stopped on purpose.
    closeError: () => (destroying() ? null : new Error('Agent process exited unexpectedly.')),
    onClose: () => {
      if (!destroying()) onUnexpectedClose()
    },
    onPermission
  })
  const input = new WritableStream<Uint8Array>({ write: (chunk) => started.write(chunk) })
  return { child: started.child, input, output: started.stdout }
}
