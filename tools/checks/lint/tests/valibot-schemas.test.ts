import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'valibot-schema-conventions'
const rules = { [`open-pencil/${rule}`]: 'error' }
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

  test('rejects a schema exported from a contract folder outside Cloud', async () => {
    const source = `${valibot}export const metricsSchema = v.object({})`
    const path = 'packages/feedback/src/contract/metrics.ts'
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(1)
  })

  test.each([
    ['geometry/schema.ts', `${valibot}export const pointSchema = v.object({ x: v.number() })`],
    [
      'packages/cloud/src/contract/documents.ts',
      `${valibot}export const documentSchema = v.object({})`
    ],
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
    const off = { [`open-pencil/${rule}`]: ['error', { placement: false }] }
    const exported = `${valibot}export const pointSchema = v.object({})`
    const misnamed = `${valibot}export const Point = v.object({})`
    expect(ruleDiagnostics(await lint(exported, off, 'tools/point.ts'), rule)).toHaveLength(0)
    expect(ruleDiagnostics(await lint(misnamed, off, 'tools/point.ts'), rule)).toHaveLength(1)
  })
})
