import { randomUUID } from 'node:crypto'
import { readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Test preload: isolate the MCP discovery file so `bun test` runs never
 * clobber the real `~/Library/Application Support/OpenPencil/mcp.json`.
 *
 * Deleting that file while the OpenPencil desktop app is running breaks every
 * MCP client: the discovery file is the only place the server's auth token is
 * published, so stdio bridges fall back to a null token and every /rpc call
 * returns 401 (surfacing as a spurious "auth issue"). The engine tests in
 * tests/engine/mcp/** call startServer()/handle.close() which writes and then
 * removes the discovery file — without isolation they did so at the real
 * platform path.
 *
 * Honored via OPENPENCIL_MCP_DISCOVERY_PATH in getDiscoveryPath()
 * (packages/mcp/src/transport/paths.ts). Per-process temp path so parallel
 * bun workers don't collide. A crypto.randomUUID() suffix guarantees that
 * PID reuse after a crash cannot reuse a stale discovery dir from a prior
 * process that happened to recycle the same PID. An operator-provided value
 * is respected.
 */
const tmpDiscoveryDir = join(tmpdir(), `openpencil-mcp-test-${process.pid}-${randomUUID()}`)
let ownsDiscoveryPath = false
if (!process.env.OPENPENCIL_MCP_DISCOVERY_PATH) {
  process.env.OPENPENCIL_MCP_DISCOVERY_PATH = join(tmpDiscoveryDir, 'mcp.json')
  ownsDiscoveryPath = true
}

/**
 * Decides liveness from a `process.kill(pid, 0)` error.
 *
 * POSIX `kill(pid, 0)` throws:
 *   - ESRCH: no such process            => dead
 *   - EPERM: process exists but we lack => ALIVE (we just can't signal it)
 *            permission to signal it
 *
 * For a DESTRUCTIVE cleanup sweep, EPERM must be treated as "alive": the
 * process exists, so its temp dir must never be deleted. (Root never sees
 * EPERM — it bypasses permission checks, so `kill` succeeds for any live PID
 * regardless of owner. EPERM only arises for a non-root user probing another
 * user's live PID, e.g. on a shared, non-sticky temp directory.) Any other
 * error shape is treated as "not alive".
 *
 * Exported (and kept pure) so the EPERM branch is unit-testable without
 * monkey-patching `process.kill`.
 */
export function isAliveFromKillError(e: unknown): boolean {
  return e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'EPERM'
}

/**
 * Returns true if the given PID is (or may be) alive, via a zero-signal probe
 * (`process.kill(pid, 0)`). See `isAliveFromKillError` for the EPERM rationale.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return isAliveFromKillError(e)
  }
}

/**
 * Best-effort cleanup of stale temp dirs from previous (crashed/killed) test
 * runs. bun's test runner does not emit 'exit'/'beforeExit' reliably, so we
 * cannot rely on a process-exit handler. Instead, sweep $TMPDIR at startup for
 * our own `openpencil-mcp-test-<pid>` dirs (with or without a UUID suffix)
 * whose owner PID is no longer alive. Live PIDs (concurrent runs) are skipped;
 * the current run's dir does not exist yet at this point so it is never touched.
 */
if (ownsDiscoveryPath) {
  // Matches both the old format (openpencil-mcp-test-<pid>) and the new
  // UUID-suffixed format (openpencil-mcp-test-<pid>-<uuid>) so leftovers
  // from either naming convention are swept. The PID is always capture group 1.
  const stalePattern = /^openpencil-mcp-test-(\d+)(?:-[a-f0-9-]+)?$/
  let entries: string[] = []
  try {
    entries = readdirSync(tmpdir())
  } catch {
    void 0
  }
  for (const name of entries) {
    const match = stalePattern.exec(name)
    if (!match) continue
    const pid = Number.parseInt(match[1], 10)
    // Skip live processes (could be a concurrent test run). The current
    // process is alive, so its (not-yet-created) dir is skipped here too.
    if (isProcessAlive(pid)) continue
    try {
      rmSync(join(tmpdir(), name), { recursive: true, force: true })
    } catch {
      void 0
    }
  }
}
