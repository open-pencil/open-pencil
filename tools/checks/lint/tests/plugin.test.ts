import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type lintPlugin from '#lint/plugin.ts'
import { noSiblingDomainPrefixedFiles } from '#lint/rules/structure.ts'
import {
  noHardcodedTipLabelsInVue,
  noNativeTitleAttributesInVue,
  noRawSvgInAppVueTemplates
} from '#lint/rules/vue/template.ts'
import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleContext, RuleDefinition, RuleSourceCode } from '#lint/support/types.ts'
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const temporaryDirectories: string[] = []

const unavailable = (member: string) => () => {
  throw new Error(`${member} is not available in the filename-only harness`)
}

/** A source-code double for rules that read only the filename and raw text; no AST is parsed. */
function filenameOnlySourceCode(source: string): RuleSourceCode {
  return {
    text: source,
    getText: () => source,
    getAllComments: unavailable('getAllComments'),
    getScope: unavailable('getScope')
  }
}

function emptyProgram(): TSESTree.Program {
  const position = { line: 1, column: 0 }
  return {
    type: AST_NODE_TYPES.Program,
    body: [],
    comments: undefined,
    sourceType: 'module',
    tokens: undefined,
    range: [0, 0],
    loc: { start: position, end: position }
  }
}

/** Rules the filename-only harness below can drive without a parsed AST. */
const harnessRules = {
  'no-sibling-domain-prefixed-files': noSiblingDomainPrefixedFiles,
  'no-native-title-attributes-in-vue': noNativeTitleAttributesInVue,
  'no-hardcoded-tip-labels-in-vue': noHardcodedTipLabelsInVue,
  'no-raw-svg-in-app-vue-templates': noRawSvgInAppVueTemplates
} satisfies Record<string, RuleDefinition>

async function runRule(
  ruleName: keyof typeof harnessRules,
  source: string,
  filename: string
): Promise<number> {
  const rule: RuleDefinition = harnessRules[ruleName]
  let reports = 0
  const context: RuleContext = {
    filename,
    physicalFilename: filename,
    options: [],
    report: () => {
      reports += 1
    },
    sourceCode: filenameOnlySourceCode(source)
  }
  const visitors = rule.create(context)
  visitors.Program?.(emptyProgram())
  return reports
}

test('domain naming uses ownership prefixes, not control-kind suffixes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-domains-'))
  temporaryDirectories.push(directory)
  await mkdir(join(directory, 'list'))
  expect(
    await runRule('no-sibling-domain-prefixed-files', '', join(directory, 'page-list.ts'))
  ).toBe(0)
  expect(
    await runRule('no-sibling-domain-prefixed-files', '', join(directory, 'list-actions.ts'))
  ).toBe(1)
})

test('storage rule permits data keys but rejects storage access', async () => {
  const rule = 'no-direct-storage-access'
  for (const [source, count] of [
    ['const state = {localStorage: []}', 0],
    ['localStorage.clear()', 1],
    ['window.sessionStorage.clear()', 1],
    ['const value = {localStorage}', 1]
  ] as const) {
    const diagnostics = await lint(source, { [`open-pencil/${rule}`]: 'error' })
    expect(ruleDiagnostics(diagnostics, rule)).toHaveLength(count)
  }
})

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
    const pluginPath = join(await resolveWorkspaceRoot(import.meta.dir), 'lint/plugin.js')
    const module = (await import(pluginPath)) as { default: typeof lintPlugin }
    expect(Object.keys(module.default.rules)).toContain('no-conditional-object-spreads')
    expect(Object.keys(module.default.rules).length).toBeGreaterThan(60)
  })
})
