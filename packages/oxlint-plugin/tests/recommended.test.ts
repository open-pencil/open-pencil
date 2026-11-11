import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DOMAINS, lintWithConfig } from '#oxlint-plugin-tests/helpers/lint'
import data from '#oxlint-plugin/plugins/data'
import imports from '#oxlint-plugin/plugins/imports'
import runtime from '#oxlint-plugin/plugins/runtime'
import security from '#oxlint-plugin/plugins/security'
import structure from '#oxlint-plugin/plugins/structure'
import types from '#oxlint-plugin/plugins/types'
import recommended from '#oxlint-plugin/recommended'
import * as v from 'valibot'

/** The file JSON configurations extend by path. */
const PRESET = fileURLToPath(new URL('../recommended.json', import.meta.url))
const presetSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.looseObject({ plugins: v.array(v.string()), rules: v.record(v.string(), v.unknown()) })
)
/** Rules that fit only some code, which a project turns on where they apply. */
const OPT_IN = new Set([
  '@open-pencil/security/no-dynamic-html',
  '@open-pencil/data/no-raw-runtime-effect',
  '@open-pencil/data/no-raw-sql',
  '@open-pencil/security/no-unvalidated-route-params'
])

/** The domain plugins, by the domain each names: `@open-pencil/<domain>`. */
const PLUGINS = { data, imports, runtime, security, structure, types }

/** Every rule the domain plugins define, by its full `@open-pencil/<domain>/<rule>` ID. */
const PLUGIN_RULES = Object.entries(PLUGINS).flatMap(([domain, plugin]) =>
  Object.keys(plugin.rules).map((rule) => `@open-pencil/${domain}/${rule}`)
)

async function preset() {
  return v.parse(presetSchema, await Bun.file(PRESET).text())
}

describe('recommended', () => {
  test('turns on every plugin rule but the opt-in ones, and only rules the plugin has', async () => {
    const { rules } = await preset()
    const enabled = Object.keys(rules).filter((rule) => rule.startsWith('@open-pencil/'))
    expect(enabled.toSorted()).toEqual(PLUGIN_RULES.filter((rule) => !OPT_IN.has(rule)).toSorted())
  })

  test('each domain plugin is named for its domain, loaded by the tests, and exported', async () => {
    const manifest = v.parse(
      v.pipe(
        v.string(),
        v.parseJson(),
        v.looseObject({ exports: v.record(v.string(), v.unknown()) })
      ),
      await Bun.file(new URL('../package.json', import.meta.url)).text()
    )
    const domains = Object.keys(PLUGINS)
    expect(Object.values(PLUGINS).map((plugin) => plugin.meta?.name)).toEqual(
      domains.map((domain) => `@open-pencil/${domain}`)
    )
    expect(domains).toEqual([...DOMAINS])
    expect(Object.keys(manifest.exports).filter((path) => path !== './recommended')).toEqual(
      domains.map((domain) => `./${domain}`)
    )
  })

  test('the module export is the JSON file', async () => {
    const exported: unknown = recommended
    expect(exported).toEqual(await preset())
  })

  test('Oxlint accepts it with the plugin and reports built-in and plugin rules', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'open-pencil-oxlint-recommended-'))
    try {
      const fixture = join(directory, 'fixture.ts')
      await writeFile(
        fixture,
        'export function f(x: number) {\n  try { if (x == 1) run() } catch {}\n}\n'
      )
      const codes = (await lintWithConfig({ extends: [PRESET] }, directory, [fixture])).map(
        (diagnostic) => diagnostic.code
      )
      expect(codes).toContain('eslint(eqeqeq)')
      expect(codes).toContain('@open-pencil/runtime(no-silent-catch)')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
