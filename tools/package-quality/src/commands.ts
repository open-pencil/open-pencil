import { defineCommand } from 'citty'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts'

import { checkTypes } from './checks/attw'
import { formatPackageDiagnostics, validatePackageMetadata } from './checks/metadata'
import { checkPublint } from './checks/publint'
import { verifyPackedPackages } from './smoke/verify'

const rootArg = { type: 'string', description: 'Explicit workspace root' } as const

async function check(root: string): Promise<void> {
  const diagnostics = await validatePackageMetadata(root)
  if (diagnostics.length > 0) throw new Error(formatPackageDiagnostics(diagnostics))
  await checkPublint(root)
  await checkTypes(root)
  console.log('Package metadata, Publint and ATTW checks passed.')
}

export const checkCommand = defineCommand({
  meta: { name: 'check', description: 'Check public package metadata and declarations' },
  args: { root: rootArg },
  async run({ args }) {
    await check(await resolveWorkspaceRoot(process.cwd(), args.root))
  }
})

export const smokeCommand = defineCommand({
  meta: { name: 'smoke', description: 'Smoke-test built public packages' },
  args: { root: rootArg },
  async run({ args }) {
    await verifyPackedPackages(await resolveWorkspaceRoot(process.cwd(), args.root))
  }
})

export const verifyCommand = defineCommand({
  meta: { name: 'verify', description: 'Run package checks and built-package smoke tests' },
  args: { root: rootArg },
  async run({ args }) {
    const root = await resolveWorkspaceRoot(process.cwd(), args.root)
    await check(root)
    await verifyPackedPackages(root)
  }
})
