import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { TauriCapabilities } from '@wdio/tauri-service'

const root = dirname(fileURLToPath(import.meta.url))
const binaryName = process.platform === 'win32' ? 'OpenPencil.exe' : 'OpenPencil'
const appBinary = join(root, 'desktop', 'target', 'debug', binaryName)

const capability: TauriCapabilities = {
  browserName: 'tauri',
  'tauri:options': { application: appBinary }
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: join(root, 'tests', 'e2e', 'native', 'tsconfig.json'),
  specs: [join(root, 'tests', 'e2e', 'native', '**', '*.spec.ts')],
  maxInstances: 1,
  maxInstancesPerCapability: 1,
  capabilities: [capability],
  services: [
    [
      '@wdio/tauri-service',
      {
        appBinaryPath: appBinary,
        driverProvider: 'embedded',
        startTimeout: 120_000
      }
    ]
  ],
  framework: 'mocha',
  reporters: ['spec'],
  logLevel: 'warn',
  waitforTimeout: 20_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  mochaOpts: { ui: 'bdd', timeout: 60_000 }
}
