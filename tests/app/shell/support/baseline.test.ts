import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

import * as v from 'valibot'

import {
  BASELINE_ECMASCRIPT_LIB,
  BROWSER_BASELINE,
  SUPPORT_SENTINELS,
  browserslistQueries,
  missingSupportSentinels,
  viteBuildTarget,
  type BaselineBrowser
} from '@/app/shell/support/baseline'

import { repoPath } from '#tests/helpers/paths'

const BROWSERS = Object.keys(BROWSER_BASELINE) as BaselineBrowser[]

const oxlintSettingsSchema = v.object({
  settings: v.object({ browsers: v.array(v.string()) })
})
const tsconfigLibSchema = v.object({
  compilerOptions: v.object({ lib: v.array(v.string()) })
})

/** tsconfigs whose output ships to browsers and must stay on the baseline lib. */
const BROWSER_TSCONFIGS = [
  'tsconfig.json',
  'packages/core/tsconfig.json',
  'packages/vue/tsconfig.json',
  'packages/dom-css/tsconfig.json',
  'packages/fig/tsconfig.json',
  'packages/pen/tsconfig.json'
]

async function readJSON<T>(schema: v.GenericSchema<unknown, T>, path: string): Promise<T> {
  return v.parse(schema, JSON.parse(await readFile(repoPath(path), 'utf8')))
}

describe('browser baseline', () => {
  test('derives the Vite build target from the baseline', () => {
    expect(viteBuildTarget()).toEqual([
      'chrome111',
      'edge111',
      'firefox128',
      'safari16.4',
      'ios16.4'
    ])
  })

  test('oxlint checks Web APIs against the same browsers', async () => {
    const { settings } = await readJSON(oxlintSettingsSchema, 'oxlint.json')
    expect(settings.browsers).toEqual(browserslistQueries())
  })

  test.each(BROWSER_TSCONFIGS)('%s pins the baseline ECMAScript lib', async (path) => {
    const { compilerOptions } = await readJSON(tsconfigLibSchema, path)
    expect(compilerOptions.lib[0]).toBe(BASELINE_ECMASCRIPT_LIB)
  })

  test.each(BROWSERS)('no sentinel demands more than the %s baseline', (browser) => {
    for (const sentinel of SUPPORT_SENTINELS) {
      const since = sentinel.since[browser]
      expect(since, `${sentinel.name} has no ${browser} entry`).toBeDefined()
      expect(since ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(BROWSER_BASELINE[browser])
    }
  })

  test.each(BROWSERS)('at least one sentinel marks the %s baseline exactly', (browser) => {
    const newest = Math.max(...SUPPORT_SENTINELS.map((sentinel) => sentinel.since[browser] ?? 0))
    expect(newest).toBe(BROWSER_BASELINE[browser])
  })

  test('reports the names of failing sentinels and tolerates throwing tests', () => {
    const missing = missingSupportSentinels([
      { name: 'present', since: {}, test: () => true },
      { name: 'absent', since: {}, test: () => false },
      {
        name: 'throws',
        since: {},
        test: () => {
          throw new TypeError('not a function')
        }
      }
    ])
    expect(missing).toEqual(['absent', 'throws'])
  })
})
