import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import * as v from 'valibot'

// worker.ts under `wrangler dev`, bundled as Wrangler bundles a deployment and run in workerd.
// Wrangler's test harness hangs under Bun, so the test runs the CLI as the end-to-end runner does.
let worker: Bun.Subprocess | undefined
let url = ''

async function freePort(): Promise<number> {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() })
  const port = probe.port ?? 0
  await probe.stop()
  return port
}

async function serving(): Promise<boolean> {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

beforeAll(async () => {
  const port = await freePort()
  url = `http://127.0.0.1:${port}/`
  worker = Bun.spawn(
    [
      'bunx',
      'wrangler',
      'dev',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--show-interactive-dev-session=false'
    ],
    {
      cwd: import.meta.dir,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      stdout: 'ignore',
      stderr: 'inherit'
    }
  )
  for (let attempt = 0; attempt < 600; attempt++) {
    if (worker.exitCode !== null) throw new Error(`wrangler dev exited with ${worker.exitCode}`)
    if (await serving()) return
    await Bun.sleep(100)
  }
  throw new Error('The Worker did not start')
}, 90_000)

afterAll(async () => {
  worker?.kill()
  await worker?.exited
})

describe('S3 errors on Workers', () => {
  test('keep their code when Wrangler bundles the SDK for the browser', async () => {
    const response = await fetch(url)
    const { name } = v.parse(v.object({ name: v.nullable(v.string()) }), await response.json())
    expect(name).toBe('AccessDenied')
  })
})
