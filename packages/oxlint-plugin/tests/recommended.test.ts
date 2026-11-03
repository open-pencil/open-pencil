import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { lintWithConfig } from '#oxlint-plugin-tests/helpers/lint'
import plugin from '#oxlint-plugin/index'
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
const OPT_IN = new Set(['no-dynamic-html', 'no-raw-sql'])

async function preset() {
  return v.parse(presetSchema, await Bun.file(PRESET).text())
}

describe('recommended', () => {
  test('turns on every plugin rule but the opt-in ones, and only rules the plugin has', async () => {
    const { rules } = await preset()
    const pluginRules = Object.keys(plugin.rules)
    const enabled = Object.keys(rules)
      .filter((rule) => rule.startsWith('open-pencil/'))
      .map((rule) => rule.slice('open-pencil/'.length))
    expect(enabled.toSorted()).toEqual(pluginRules.filter((rule) => !OPT_IN.has(rule)).toSorted())
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
      expect(codes).toContain('open-pencil(no-silent-catch)')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
