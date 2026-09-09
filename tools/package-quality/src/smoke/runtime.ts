import { join } from 'node:path'

import {
  concreteImportSpecifiers,
  runCommand,
  type PackageManifest
} from '@open-pencil/package-artifacts'

export type RuntimeName = 'bun' | 'node'

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

export async function verifyPublicImports(
  manifests: PackageManifest[],
  consumerDirectory: string
): Promise<void> {
  const skipped = new Set(['@open-pencil/mcp/stdio'])
  const specifiers = manifests
    .flatMap(concreteImportSpecifiers)
    .filter((specifier) => !skipped.has(specifier))
    .sort()

  for (const runtime of ['node', 'bun'] as const) {
    for (const specifier of specifiers) {
      await evaluateRuntime(
        runtime,
        `await import(${JSON.stringify(specifier)})`,
        consumerDirectory
      )
    }
  }
}

export async function verifyRuntimeScenarios(
  scenarios: ReadonlyArray<{ code: string }>,
  consumerDirectory: string
): Promise<void> {
  for (const runtime of ['node', 'bun'] as const) {
    for (const scenario of scenarios) {
      await evaluateRuntime(runtime, scenario.code, consumerDirectory)
    }
  }
}

export async function verifyPackageBinaries(consumerDirectory: string): Promise<void> {
  const binaryDirectory = join(consumerDirectory, 'node_modules', '.bin')
  const binaries = ['openpencil', 'openpencil-mcp', 'openpencil-mcp-http']
  for (const runtime of ['node', 'bun'] as const) {
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
