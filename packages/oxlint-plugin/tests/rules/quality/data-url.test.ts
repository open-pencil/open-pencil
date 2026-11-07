import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

const rule = 'no-hand-rolled-data-url'
const rules = { [`open-pencil/${rule}`]: 'error' }

describe('no-hand-rolled-data-url', () => {
  test.each([
    `const url = \`data:image/png;base64,\${fromUint8Array(bytes)}\``,
    `const url = \`data:\${mime};base64,\${fromUint8Array(bytes)}\`.length`,
    `const css = \`url("data:image/svg+xml,\${encodeURIComponent(svg)}") 12 12, auto\``,
    "value.startsWith('data:image/')"
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    `const url = \`data:image/png;base64,\${encoded}\``,
    "line.startsWith('data: ')",
    "line.startsWith('data:')",
    `const link = \`https://example.com/\${encodeURIComponent(name)}\``
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
