import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import type lintPlugin from '#lint/plugin.ts'
import {
  noHardcodedTipLabelsInVue,
  noNativeTitleAttributesInVue,
  noRawSvgInAppVueTemplates
} from '#lint/rules/vue/template.ts'
import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleContext, RuleDefinition, RuleSourceCode } from '#lint/support/types.ts'
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

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

test('storage rule permits data keys but rejects storage access', async () => {
  const rule = 'no-direct-storage-access'
  const cases = {
    'data-key.ts': ['const state = {localStorage: []}', 0],
    'clear.ts': ['localStorage.clear()', 1],
    'window-session.ts': ['window.sessionStorage.clear()', 1],
    'shorthand.ts': ['const value = {localStorage}', 1]
  } as const
  const diagnostics = ruleDiagnostics(
    await lintFiles(
      Object.fromEntries(Object.entries(cases).map(([path, [source]]) => [path, source])),
      { [`open-pencil/${rule}`]: 'error' }
    ),
    rule
  )
  for (const [path, [, count]] of Object.entries(cases)) {
    const found = diagnostics.filter((diagnostic) => diagnostic.filename?.endsWith(path))
    expect(found, path).toHaveLength(count)
  }
})

describe('Vue template rules', () => {
  test('recognizes native title attributes from the Vue template AST', async () => {
    const reports = await runRule(
      'no-native-title-attributes-in-vue',
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
  test("loads this repository's rules and the published plugin's as one plugin", async () => {
    const pluginPath = join(await resolveWorkspaceRoot(import.meta.dir), 'lint/plugin.js')
    const module = (await import(pluginPath)) as { default: typeof lintPlugin }
    const rules = Object.keys(module.default.rules)
    expect(module.default.meta.name).toBe('open-pencil')
    expect(rules).toContain('no-conditional-object-spreads')
    expect(rules).toContain('no-direct-storage-access')
  })
})
