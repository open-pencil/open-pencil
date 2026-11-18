import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

const rule = '@open-pencil/data/valibot-schema-conventions'
const rules = { [rule]: 'error' }
const valibot = "import * as v from 'valibot'\n"

describe(rule, () => {
  test.each([
    `${valibot}const Point = v.object({ x: v.number() })`,
    `${valibot}const point = v.object({ x: v.number() })`,
    `${valibot}const PointSchema = v.object({ x: v.number() })`,
    `${valibot}const PointJSON = v.pipe(v.string(), v.parseJson())`,
    `${valibot}const point = v.object({}) satisfies v.GenericSchema`,
    "import { object } from 'valibot'\nconst Point = object({})"
  ])('rejects the name in %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    `${valibot}export const pointSchema = v.object({ x: v.number() })`,
    `${valibot}const pointSchema = v.object({ x: v.number() })\nexport { pointSchema }`,
    `${valibot}export { pointSchema }\nconst pointSchema = v.object({ x: v.number() })`,
    "import { object } from 'valibot'\nexport const pointSchema = object({})"
  ])('rejects a schema exported from another module: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules, 'geometry/point.ts'), rule)).toHaveLength(1)
  })

  describe('schemaModules', () => {
    const withContract = {
      [rule]: ['error', { schemaModules: ['/packages/cloud/src/contract/'] }]
    }
    const source = `${valibot}export const documentSchema = v.object({})`

    test('accepts a schema exported from a named module directory', async () => {
      const path = 'packages/cloud/src/contract/documents.ts'
      expect(ruleDiagnostics(await lint(source, withContract, path), rule)).toHaveLength(0)
    })

    test('rejects one exported from another contract folder', async () => {
      const path = 'packages/feedback/src/contract/metrics.ts'
      expect(ruleDiagnostics(await lint(source, withContract, path), rule)).toHaveLength(1)
    })

    test('matches a named directory whole, not as a prefix of another', async () => {
      const prefixOnly = {
        [rule]: ['error', { schemaModules: ['/packages/cloud/src/contract'] }]
      }
      const inside = 'packages/cloud/src/contract/documents.ts'
      const beside = 'packages/cloud/src/contracts-extra/documents.ts'
      expect(ruleDiagnostics(await lint(source, prefixOnly, inside), rule)).toHaveLength(0)
      expect(ruleDiagnostics(await lint(source, prefixOnly, beside), rule)).toHaveLength(1)
    })

    test('rejects one from a contract folder no option names', async () => {
      const path = 'packages/cloud/src/contract/documents.ts'
      expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(1)
    })
  })

  test.each([
    ['geometry/schema.ts', `${valibot}export const pointSchema = v.object({ x: v.number() })`],
    ['geometry/point.ts', `${valibot}const pointSchema = v.object({ x: v.number() })`],
    ['geometry/point.ts', `${valibot}export const point = v.parse(v.number(), 1)`],
    ['geometry/point.ts', `${valibot}export const title = v.getTitle(v.string())`],
    ['geometry/point.ts', `${valibot}const minimum = v.minLength(1)`],
    ['geometry/point.ts', `${valibot}function read() { const Local = v.object({}); return Local }`],
    ['geometry/point.ts', `${valibot}export { pointSchema } from './schema'`],
    ['geometry/point.ts', 'const Point = object({ x: 1 })']
  ])('accepts %s', async (path, source) => {
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })

  test('checks names only when placement is off', async () => {
    const off = { [rule]: ['error', { placement: false }] }
    const exported = `${valibot}export const pointSchema = v.object({})`
    const misnamed = `${valibot}export const Point = v.object({})`
    expect(ruleDiagnostics(await lint(exported, off, 'tools/point.ts'), rule)).toHaveLength(0)
    expect(ruleDiagnostics(await lint(misnamed, off, 'tools/point.ts'), rule)).toHaveLength(1)
  })
})
