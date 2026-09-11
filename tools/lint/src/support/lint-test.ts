import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Diagnostic {
  code: string
  filename: string
  message: string
}

interface LintResult {
  diagnostics: Diagnostic[]
}

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const temporaryDirectories: string[] = []
const pluginPath = resolve(currentDirectory, '../../../../lint/plugin.js')
const oxlintPath = resolve(currentDirectory, '../../../../node_modules/.bin/oxlint')

async function runOxlint(
  arguments_: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  return await new Promise((resolveProcess, reject) => {
    const child = spawn(oxlintPath, arguments_)
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => resolveProcess({ stdout, stderr, code: code ?? 1 }))
  })
}

export async function lint(
  source: string,
  rules: Record<string, string>,
  relativePath = 'fixture.ts'
): Promise<Diagnostic[]> {
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-lint-'))
  temporaryDirectories.push(directory)
  const sourcePath = join(directory, relativePath)
  const configPath = join(directory, 'oxlint.json')
  await mkdir(dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, source)
  await writeFile(
    configPath,
    JSON.stringify({
      plugins: ['typescript', 'vue'],
      jsPlugins: [pluginPath],
      rules
    })
  )

  const { stdout, stderr, code } = await runOxlint([
    '-c',
    configPath,
    '--format',
    'json',
    sourcePath
  ])
  try {
    return (JSON.parse(stdout) as LintResult).diagnostics
  } catch {
    throw new Error(`oxlint exited ${code} without JSON output.\nstderr: ${stderr}`)
  }
}

export function ruleDiagnostics(diagnostics: Diagnostic[], rule: string): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.code === `open-pencil(${rule})`)
}

export async function cleanupLintFixtures(): Promise<void> {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
}
