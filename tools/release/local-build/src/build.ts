import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { runCommand } from '@open-pencil/package-artifacts-tools'

export const PRODUCT_NAME = 'OpenPencil Local'
export const IDENTIFIER = 'net.dannote.open-pencil.local'

export function localConfig() {
  return {
    productName: PRODUCT_NAME,
    identifier: IDENTIFIER,
    bundle: {
      createUpdaterArtifacts: false,
      fileAssociations: [],
      macOS: { signingIdentity: '-' }
    },
    plugins: { updater: { endpoints: [] }, 'deep-link': { desktop: { schemes: [] } } }
  }
}

export function parseOptions(args: string[], platform: NodeJS.Platform) {
  for (const arg of args) {
    if (arg !== '--install' && arg !== '--help') throw new Error('Unknown argument: ' + arg)
  }
  const install = args.includes('--install')
  if (install && platform !== 'darwin') throw new Error('--install is supported only on macOS')
  return { install, help: args.includes('--help') }
}

export async function buildLocal(options: {
  root: string
  home: string
  platform: NodeJS.Platform
  install: boolean
  run?: typeof runCommand
  log?: (message: string) => void
}) {
  const { root, platform, install, home, run = runCommand, log = console.log } = options
  if (install && platform !== 'darwin') throw new Error('--install is supported only on macOS')
  const target = join(root, 'desktop', 'target', 'local')
  await run({
    command: 'bun',
    args: ['run', 'tauri', 'build', '--config', JSON.stringify(localConfig())],
    cwd: root,
    output: 'inherit',
    env: {
      ...process.env,
      CARGO_TARGET_DIR: target,
      CARGO_BUILD_TARGET: undefined,
      OPENPENCIL_CREDENTIAL_SERVICE: IDENTIFIER + '.credentials',
      ...(platform === 'darwin' ? { APPLE_SIGNING_IDENTITY: '-' } : {})
    }
  })
  const bundle = join(target, 'release', 'bundle')
  log('Local bundles: ' + bundle)
  if (install) {
    const applications = join(home, 'Applications')
    const destination = join(applications, PRODUCT_NAME + '.app')
    await mkdir(applications, { recursive: true })
    // Replace only this tool's local app, rather than merging stale bundle files.
    await rm(destination, { recursive: true, force: true })
    await run({
      command: 'ditto',
      args: [join(bundle, 'macos', PRODUCT_NAME + '.app'), destination],
      cwd: root
    })
    log('Installed: ' + destination)
  }
  return bundle
}
