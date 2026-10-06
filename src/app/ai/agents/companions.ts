import { APP_VERSION } from '@/app/runtime/version'

function majorMinor(version: string): string | null {
  const match = /^(\d+)\.(\d+)/.exec(version)
  return match ? `${match[1]}.${match[2]}` : null
}

/**
 * Whether an installed OpenPencil companion (MCP server, Harness) is too old or new for this app.
 * Companions must match the app's major.minor version. One that reports no version predates
 * `--version`, which the desktop app asks every installed companion, so it is outdated too.
 */
export function isOutdatedCompanion(
  version: string | null | undefined,
  appVersion: string = APP_VERSION
): boolean {
  if (!version) return true
  return majorMinor(version) !== majorMinor(appVersion)
}

const BUN_GLOBAL_BIN = /[\\/]\.bun[\\/]/

/** The command that replaces a global package with the package manager that installed it. */
export function globalInstallCommand(target: string, executablePath?: string | null): string {
  return executablePath && BUN_GLOBAL_BIN.test(executablePath)
    ? `bun add -g ${target}`
    : `npm i -g ${target}`
}
