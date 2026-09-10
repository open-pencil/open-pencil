import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'

import { waitForChildReady } from '@/app/automation/bridge/child-ready'

test('accepts a readiness marker split across child output chunks', async () => {
  const child = spawn(
    process.execPath,
    ['-e', 'process.stderr.write("ready:"); setTimeout(() => process.stderr.write("test\\n"), 10)'],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  )
  await waitForChildReady(child, 'ready:test')
})

test('rejects child exit without readiness even if other output looks healthy', async () => {
  const child = spawn(process.execPath, ['-e', 'process.stderr.write("HTTP healthy\\n")'], {
    stdio: ['ignore', 'ignore', 'pipe']
  })
  await expect(waitForChildReady(child, 'ready:test')).rejects.toThrow('exited before readiness')
})
