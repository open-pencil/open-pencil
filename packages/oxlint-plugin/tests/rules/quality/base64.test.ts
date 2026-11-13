import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

const rule = '@open-pencil/data/no-hand-rolled-base64'
const rules = { [rule]: 'error' }

describe('@open-pencil/data/no-hand-rolled-base64', () => {
  test.each([
    "atob('AA==')",
    "btoa('a')",
    "globalThis.atob('AA==')",
    "window['btoa']('a')",
    "Buffer.from(value, 'base64')",
    "Buffer.from(value, 'base64url')",
    "bytes.toString('base64')"
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    "import { toUint8Array } from 'js-base64'; toUint8Array('AA==')",
    'function decode(atob: (value: string) => string) { return atob("AA==") }',
    "Buffer.from(script, 'utf16le')",
    "bytes.toString('hex')",
    'value.toString()'
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
