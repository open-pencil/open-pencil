import { spawnAgentProcess, type AgentChild } from '@/app/ai/agents/process'
import { platformCommandEnv } from '@/app/tauri/command'

/** A started agent: its process, and the pipes the ACP connection reads and writes. */
export interface ACPProcess {
  child: AgentChild
  input: WritableStream<Uint8Array>
  output: ReadableStream<Uint8Array>
}

type ACPProcessOptions = {
  command: string
  args: string[]
  logId: string
  /** The `PATH` the agent starts with, from the lookup that found it; omitted keeps the app's. */
  searchPath?: string | null
  /**
   * The folder the agent runs in, the same one its sessions open in. Antigravity CLI adds its
   * process folder to the session's workspace, which would otherwise be wherever the app started.
   */
  cwd?: string
  destroying: () => boolean
  onUnexpectedClose: () => void
}

export async function spawnACPProcess({
  command,
  args,
  logId,
  searchPath = null,
  cwd,
  destroying,
  onUnexpectedClose
}: ACPProcessOptions): Promise<ACPProcess> {
  const agent = await spawnAgentProcess({
    command,
    args,
    env: { ...platformCommandEnv(), ...(searchPath ? { PATH: searchPath } : {}) },
    cwd,
    onStderr: (text) => console.error(`[ACP ${logId}]`, text),
    // A connection still reading learns the agent is gone, unless it was stopped on purpose.
    closeError: () => (destroying() ? null : new Error('Agent process exited unexpectedly.')),
    onClose: () => {
      if (!destroying()) onUnexpectedClose()
    }
  })
  const input = new WritableStream<Uint8Array>({ write: (chunk) => agent.write(chunk) })
  return { child: agent.child, input, output: agent.stdout }
}
