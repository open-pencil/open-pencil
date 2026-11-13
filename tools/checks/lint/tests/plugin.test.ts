import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { domains } from '#lint/domains.ts'
import {
  noHardcodedTipLabelsInVue,
  noNativeTitleAttributesInVue,
  noRawSvgInAppVueTemplates
} from '#lint/rules/vue/template.ts'
import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleContext, RuleDefinition, RuleSourceCode } from '#lint/support/types.ts'
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'
import * as v from 'valibot'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const domainPluginSchema = v.object({
  meta: v.object({ name: v.string() }),
  rules: v.record(v.string(), v.unknown())
})

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
  '@open-pencil/vue/no-native-title-attributes': noNativeTitleAttributesInVue,
  '@open-pencil/vue/no-hardcoded-tip-labels': noHardcodedTipLabelsInVue,
  '@open-pencil/vue/no-raw-svg-in-templates': noRawSvgInAppVueTemplates
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
  const rule = '@open-pencil/runtime/no-direct-storage-access'
  const cases = {
    'data-key.ts': ['const state = {localStorage: []}', 0],
    'clear.ts': ['localStorage.clear()', 1],
    'window-session.ts': ['window.sessionStorage.clear()', 1],
    'shorthand.ts': ['const value = {localStorage}', 1]
  } as const
  const diagnostics = ruleDiagnostics(
    await lintFiles(
      Object.fromEntries(Object.entries(cases).map(([path, [source]]) => [path, source])),
      { [rule]: 'error' }
    ),
    rule
  )
  for (const [path, [, count]] of Object.entries(cases)) {
    const found = diagnostics.filter((diagnostic) => diagnostic.filename?.endsWith(path))
    expect(found, path).toHaveLength(count)
  }
})

test('only the development reload module reads import.meta.hot', async () => {
  const rule = '@open-pencil/runtime/no-vite-hot-outside-reload'
  const cases = {
    'src/app/shell/reload/vite.ts': ["import.meta.hot?.on('vite:ws:disconnect', () => {})", 0],
    'src/app/ai/chat/use.ts': ["import.meta.hot?.on('vite:ws:disconnect', () => {})", 1],
    'src/app/env.ts': ['export const dev = import.meta.env.DEV', 0]
  } as const
  const diagnostics = ruleDiagnostics(
    await lintFiles(
      Object.fromEntries(Object.entries(cases).map(([path, [source]]) => [path, source])),
      { [rule]: 'error' }
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
      '@open-pencil/vue/no-native-title-attributes',
      '<template><button title="Save">Save</button></template>',
      '/repo/src/components/SaveButton.vue'
    )
    expect(reports).toBe(1)
  })

  test('finds raw SVG elements with v-if directives', async () => {
    const reports = await runRule(
      '@open-pencil/vue/no-raw-svg-in-templates',
      '<template><svg v-if="shown" /></template>',
      '/repo/src/components/ConditionalIcon.vue'
    )
    expect(reports).toBe(1)
  })

  test('does not treat a Vue component title prop as a native title attribute', async () => {
    const reports = await runRule(
      '@open-pencil/vue/no-native-title-attributes',
      '<template><Dialog title="Settings" /></template>',
      '/repo/src/components/SettingsDialog.vue'
    )
    expect(reports).toBe(0)
  })

  test('reports a hardcoded Vue tooltip label', async () => {
    const reports = await runRule(
      '@open-pencil/vue/no-hardcoded-tip-labels',
      '<template><Tip label="Save" /></template>',
      '/repo/src/components/SaveButton.vue'
    )
    expect(reports).toBe(1)
  })

  test('accepts a localized Vue tooltip binding', async () => {
    const rule = '@open-pencil/vue/no-hardcoded-tip-labels'
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

describe('domain plugins', () => {
  test("loads a domain as `@open-pencil/<domain>` with the published plugin's rules beside this repository's", async () => {
    const path = join(await resolveWorkspaceRoot(import.meta.dir), 'lint/runtime.js')
    const plugin = v.parse(
      domainPluginSchema,
      ((await import(path)) as { default: unknown }).default
    )
    expect(plugin.meta.name).toBe('@open-pencil/runtime')
    expect(Object.keys(plugin.rules)).toEqual(
      expect.arrayContaining(['no-conditional-object-spreads', 'no-direct-storage-access'])
    )
  })

  test('oxlint.json loads every domain', async () => {
    const root = await resolveWorkspaceRoot(import.meta.dir)
    const config = v.parse(
      v.pipe(v.string(), v.parseJson(), v.looseObject({ jsPlugins: v.array(v.string()) })),
      await Bun.file(join(root, 'oxlint.json')).text()
    )
    expect(config.jsPlugins).toEqual(
      expect.arrayContaining(Object.keys(domains).map((domain) => `./lint/${domain}.js`))
    )
  })
})
