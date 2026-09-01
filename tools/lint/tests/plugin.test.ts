import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import lintPlugin from '../src/plugin.ts'
import { normalizedFilename } from '../src/support/context.ts'

interface Diagnostic {
  code: string
  filename: string
  message: string
}

interface LintResult {
  diagnostics: Diagnostic[]
}

const temporaryDirectories: string[] = []
const pluginPath = resolve(import.meta.dir, '../../../lint/plugin.js')
const oxlintPath = resolve(import.meta.dir, '../../../node_modules/.bin/oxlint')

async function lint(
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

  const process = Bun.spawn([oxlintPath, '-c', configPath, '--format', 'json', sourcePath], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [output, errorOutput] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text()
  ])
  const exitCode = await process.exited
  try {
    return (JSON.parse(output) as LintResult).diagnostics
  } catch {
    throw new Error(`oxlint exited ${exitCode} without JSON output.\nstderr: ${errorOutput}`)
  }
}

async function runRule(ruleName: string, source: string, filename: string): Promise<number> {
  const plugin = lintPlugin
  let reports = 0
  const visitors = plugin.rules[ruleName].create({
    filename,
    physicalFilename: filename,
    options: [],
    report: () => {
      reports += 1
    },
    sourceCode: {
      getText: () => source
    }
  })
  visitors.Program?.({ type: 'Program' })
  return reports
}

function ruleDiagnostics(diagnostics: Diagnostic[], rule: string): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.code === `open-pencil(${rule})`)
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

describe('no-conditional-object-spreads', () => {
  const rule = 'no-conditional-object-spreads'
  const rules = { [`open-pencil/${rule}`]: 'error' }

  test('accepts a simple one-property projection', async () => {
    const diagnostics = await lint(
      'export const result = { ...(enabled ? { value: 1 } : {}) }',
      rules
    )
    expect(ruleDiagnostics(diagnostics, rule)).toHaveLength(0)
  })

  test('reports a multi-property conditional projection', async () => {
    const diagnostics = await lint(
      'export const result = { ...(enabled ? { value: 1, label: "yes" } : {}) }',
      rules
    )
    expect(ruleDiagnostics(diagnostics, rule)).toHaveLength(1)
  })

  test('reports multiple conditional projections in one object', async () => {
    const diagnostics = await lint(
      'export const result = { ...(first ? { a: 1 } : {}), ...(second ? { b: 2 } : {}) }',
      rules
    )
    expect(ruleDiagnostics(diagnostics, rule)).toHaveLength(2)
  })
})

describe('AST-backed rules', () => {
  test('recognizes Record<string, unknown> from the TypeScript AST', async () => {
    const rule = 'no-unknown-record-double-cast'
    const diagnostics = await lint(
      'export const result = value as unknown as Record< string, unknown >',
      { [`open-pencil/${rule}`]: 'error' }
    )
    expect(ruleDiagnostics(diagnostics, rule)).toHaveLength(1)
  })

  test('keeps distinct callback signatures out of duplicate type diagnostics', async () => {
    const rule = 'no-duplicate-type-shapes'
    const diagnostics = await lint(
      [
        'interface First { handler: (value: string) => number; enabled: boolean }',
        'interface Second { handler: (value: number) => number; enabled: boolean }'
      ].join('\n'),
      { [`open-pencil/${rule}`]: 'error' }
    )
    expect(ruleDiagnostics(diagnostics, rule)).toHaveLength(0)
  })

  test('recognizes native title attributes from the Vue template AST', async () => {
    const rule = 'no-native-title-attributes-in-vue'
    const reports = await runRule(
      rule,
      '<template><button title="Save">Save</button></template>',
      '/repo/src/components/SaveButton.vue'
    )
    expect(reports).toBe(1)
  })

  test('finds raw SVG elements with v-if directives', async () => {
    const reports = await runRule(
      'no-raw-svg-in-app-vue-templates',
      '<template><svg v-if="shown" /></template>',
      '/repo/src/components/ConditionalIcon.vue'
    )
    expect(reports).toBe(1)
  })

  test('does not treat a Vue component title prop as a native title attribute', async () => {
    const reports = await runRule(
      'no-native-title-attributes-in-vue',
      '<template><Dialog title="Settings" /></template>',
      '/repo/src/components/SettingsDialog.vue'
    )
    expect(reports).toBe(0)
  })

  test('reports a hardcoded Vue tooltip label', async () => {
    const reports = await runRule(
      'no-hardcoded-tip-labels-in-vue',
      '<template><Tip label="Save" /></template>',
      '/repo/src/components/SaveButton.vue'
    )
    expect(reports).toBe(1)
  })

  test('accepts a localized Vue tooltip binding', async () => {
    const rule = 'no-hardcoded-tip-labels-in-vue'
    const reports = await runRule(
      rule,
      '<template><Tip :label="messages.save" /></template>',
      '/repo/src/components/SaveButton.vue'
    )
    expect(reports).toBe(0)
  })
})

describe('path support', () => {
  test('prefers and normalizes the physical filename', () => {
    const context = {
      filename: 'virtual.ts',
      physicalFilename: String.raw`C:\repo\src\physical.ts`
    }
    expect(normalizedFilename(context)).toBe('C:/repo/src/physical.ts')
  })
})

describe('plugin entrypoint', () => {
  test('loads all custom rules through the compatibility entrypoint', async () => {
    const module = (await import(pluginPath)) as { default: typeof lintPlugin }
    expect(Object.keys(module.default.rules)).toContain('no-conditional-object-spreads')
    expect(Object.keys(module.default.rules).length).toBeGreaterThan(60)
  })
})
