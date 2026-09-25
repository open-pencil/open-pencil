import { mkdir } from 'node:fs/promises'

import { runCommand } from '@open-pencil/package-artifacts'

const INIT_TIMEOUT_MS = 60_000
const INSTALL_TIMEOUT_MS = 120_000

export async function installPackedPackages(
  consumerDirectory: string,
  tarballs: string[]
): Promise<void> {
  await mkdir(consumerDirectory, { recursive: true })
  await runCommand({
    command: 'npm',
    args: ['init', '-y'],
    cwd: consumerDirectory,
    timeoutMs: INIT_TIMEOUT_MS
  })
  await runCommand({
    command: 'npm',
    args: ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs],
    cwd: consumerDirectory,
    timeoutMs: INSTALL_TIMEOUT_MS
  })
}
