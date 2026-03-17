import { decodeTauriStderr } from '@/utils/tauri'
import { AUTOMATION_HTTP_PORT, IS_TAURI } from '@open-pencil/core'

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${AUTOMATION_HTTP_PORT}/health`, {
      signal: AbortSignal.timeout(1000)
    })
    return res.ok
  } catch {
    return false
  }
}

async function pollHealth(retries: number, delayMs: number): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, delayMs))
    if (await checkHealth()) return true
  }
  return false
}

export async function spawnMCPIfNeeded(): Promise<(() => void) | null> {
  if (import.meta.env.DEV || !IS_TAURI) return null

  if (await checkHealth()) return null

  const { Command } = await import('@tauri-apps/plugin-shell')
  const command = Command.create('openpencil-mcp', [])

  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    console.error('[MCP]', decodeTauriStderr(raw))
  })

  command.on('close', (data: { code: number | null }) => {
    console.error(`[MCP] Server exited (code ${data.code ?? 'null'})`)
  })

  const child = await command.spawn()

  if (await pollHealth(5, 1000)) {
    return () => {
      void child.kill()
    }
  }

  await child.kill()
  throw new Error(
    'Failed to start MCP server. Is openpencil-mcp installed? Run: npm i -g @open-pencil/mcp'
  )
}
