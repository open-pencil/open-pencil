import { mkdir } from 'node:fs/promises'

import { runCommand } from '@open-pencil/package-artifacts'

export async function installPackedPackages(
  consumerDirectory: string,
  tarballs: string[]
): Promise<void> {
  await mkdir(consumerDirectory, { recursive: true })
  await runCommand({ command: 'npm', args: ['init', '-y'], cwd: consumerDirectory })
  await runCommand({
    command: 'npm',
    args: ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs],
    cwd: consumerDirectory,
    timeoutMs: 120_000
  })
}
