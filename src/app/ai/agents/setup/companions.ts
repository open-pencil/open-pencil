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

export type PackageManager = 'npm' | 'bun'

/**
 * The package manager that installed a global companion. Updating it with another one would
 * leave the old copy first on PATH, so installs and commands follow this.
 */
export function companionPackageManager(executablePath?: string | null): PackageManager {
  return executablePath && BUN_GLOBAL_BIN.test(executablePath) ? 'bun' : 'npm'
}

/**
 * The command that installs a global package by hand. npm whose global folder needs
 * administrator rights runs through sudo on macOS and Linux; Windows keeps npm per user.
 */
export function globalInstallCommand(
  target: string,
  manager: PackageManager,
  options: { admin?: boolean; windows?: boolean } = {}
): string {
  if (manager === 'bun') return `bun add -g ${target}`
  const command = `npm i -g ${target}`
  return options.admin && !options.windows ? `sudo ${command}` : command
}
