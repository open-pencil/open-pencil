import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = '@open-pencil/data/no-provider-id-checks'
const rules = { [rule]: 'error' }
const path = 'src/app/ai/models/example.ts'

describe('@open-pencil/data/no-provider-id-checks', () => {
  test.each([
    "export const acp = (id: string) => id.startsWith('acp:')",
    "export const harness = (id: string) => id.startsWith('harness:')",
    "export const pi = (id: string) => id === 'harness:pi'",
    "export const notPi = (id: string) => 'harness:pi' !== id",
    "import { HARNESS_PROVIDER_ID } from '@open-pencil/core/constants'\nexport const pi = (id: string) => id === HARNESS_PROVIDER_ID"
  ])('rejects reading a kind by hand: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(1)
  })

  test.each([
    "import { providerKind } from '@open-pencil/core/constants'\nexport const acp = (id: string) => providerKind(id) === 'acp'",
    "export const logos = { 'harness:pi': 'bot' }",
    "export const install = (setup: { installAgent(id: string): void }) => setup.installAgent('harness:pi')",
    "export const data = (url: string) => url.startsWith('data:')"
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })
})
