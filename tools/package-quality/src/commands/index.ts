import { defineCommand } from 'citty'

import { runPackageQualityCommand } from './run'

export const PACKAGE_CHECK_ENTRYPOINTS = [
  'tools/package-quality/src/checks/metadata.ts',
  'tools/package-quality/src/checks/publint.ts',
  'tools/package-quality/src/checks/attw.ts'
]

export const checkCommand = defineCommand({
  meta: { name: 'check', description: 'Check public package metadata and declarations' },
  async run() {
    await runPackageQualityCommand(PACKAGE_CHECK_ENTRYPOINTS)
  }
})

export const smokeCommand = defineCommand({
  meta: { name: 'smoke', description: 'Smoke-test built public packages' },
  async run() {
    await runPackageQualityCommand(['tools/package-quality/src/smoke.ts'])
  }
})

export const verifyCommand = defineCommand({
  meta: { name: 'verify', description: 'Run package checks and built-package smoke tests' },
  async run() {
    await runPackageQualityCommand([
      ...PACKAGE_CHECK_ENTRYPOINTS,
      'tools/package-quality/src/smoke.ts'
    ])
  }
})
