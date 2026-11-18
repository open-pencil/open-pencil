import { join } from 'node:path'

import {
  concreteImportSpecifiers,
  runCommand,
  type CommandRequest,
  type PackageManifest
} from '@open-pencil/package-artifacts-tools'

import { runPackageChecks } from '../checks/run'

export type RuntimeName = 'bun' | 'node'
const RUNTIMES = ['node', 'bun'] as const
const IMPORT_CONCURRENCY = 4

const RUNTIME_TIMEOUT_MS = 30_000

function runtimeEvalArgs(runtime: RuntimeName, code: string): string[] {
  return runtime === 'node' ? ['--input-type=module', '--eval', code] : ['--eval', code]
}

export async function evaluateRuntime(
  runtime: RuntimeName,
  code: string,
  consumerDirectory: string
): Promise<void> {
  await runCommand({
    command: runtime,
    args: runtimeEvalArgs(runtime, code),
    cwd: consumerDirectory,
    timeoutMs: RUNTIME_TIMEOUT_MS
  })
}

/**
 * What checks a public specifier: importing a module, or for a stylesheet, which a bundler
 * imports but Node and Bun cannot, finding the file its export names, since resolving alone
 * succeeds for a file that was never shipped.
 */
export function publicImportCheck(specifier: string): string {
  const quoted = JSON.stringify(specifier)
  if (!specifier.endsWith('.css')) return `await import(${quoted})`
  return [
    "const { existsSync } = await import('node:fs')",
    "const { fileURLToPath } = await import('node:url')",
    `if (!existsSync(fileURLToPath(import.meta.resolve(${quoted})))) throw new Error(${JSON.stringify(`${specifier} is not shipped`)})`
  ].join('; ')
}

export async function verifyPublicImports(
  manifests: PackageManifest[],
  consumerDirectory: string,
  execute: typeof runCommand = runCommand
): Promise<void> {
  // The stdio server starts on import; the runtime assets module imports `?url` assets, which
  // only a Vite build resolves, and the plugin's Vite build test covers it instead. Cloud's
  // Cloudflare runtime imports `cloudflare:workers`, which only Workers resolve; CI bundles the
  // official Workers with it (`tools/ci/cloud-deploy/src/bundle.ts`).
  const skipped = new Set([
    '@open-pencil/mcp/stdio',
    '@open-pencil/core/runtime-assets/install',
    '@open-pencil/cloud/runtime/cloudflare'
  ])
  const specifiers = manifests
    .flatMap(concreteImportSpecifiers)
    .filter((specifier) => !skipped.has(specifier))
    .sort()

  const requests: CommandRequest[] = RUNTIMES.flatMap((runtime) =>
    specifiers.map((specifier) => ({
      command: runtime,
      args: runtimeEvalArgs(runtime, publicImportCheck(specifier)),
      cwd: consumerDirectory,
      timeoutMs: RUNTIME_TIMEOUT_MS
    }))
  )
  await runPackageChecks(requests, execute, IMPORT_CONCURRENCY)
}

export async function verifyRuntimeScenarios(
  scenarios: ReadonlyArray<{ code: string }>,
  consumerDirectory: string
): Promise<void> {
  for (const runtime of RUNTIMES) {
    for (const scenario of scenarios) {
      await evaluateRuntime(runtime, scenario.code, consumerDirectory)
    }
  }
}

export async function verifyPackageBinaries(consumerDirectory: string): Promise<void> {
  const binaryDirectory = join(consumerDirectory, 'node_modules', '.bin')
  const binaries = [
    'openpencil',
    'openpencil-mcp',
    'openpencil-mcp-http',
    'openpencil-cloud',
    'openpencil-services'
  ]
  for (const runtime of RUNTIMES) {
    for (const binary of binaries) {
      await runCommand({
        command: runtime,
        args: [join(binaryDirectory, binary), '--help'],
        cwd: consumerDirectory,
        timeoutMs: RUNTIME_TIMEOUT_MS
      })
    }
  }
}
