import type { ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { Readable } from 'node:stream'

/** Readiness is acknowledged over the owned child pipe, never by a public HTTP listener. */
export function waitForChildReady(
  child: ChildProcess & { stderr: Readable },
  marker: string,
  timeoutMs = 10_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const lines = createInterface({ input: child.stderr })
    const timer = setTimeout(() => finish(new Error('MCP child readiness timed out')), timeoutMs)
    function finish(error?: Error) {
      clearTimeout(timer)
      lines.close()
      child.off('exit', onExit)
      child.off('error', onError)
      if (error) reject(error)
      else resolve()
    }
    function onExit() {
      finish(new Error('MCP child exited before readiness acknowledgement'))
    }
    function onError(error: Error) {
      finish(error)
    }
    child.once('exit', onExit)
    child.once('error', onError)
    lines.on('line', (line) => {
      if (line === marker) finish()
    })
  })
}
