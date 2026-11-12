import { describe, expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const rule = '@open-pencil/data/no-hand-rolled-data-url'
const rules = { [rule]: 'error' }

const rejected = [
  `const url = \`data:image/png;base64,\${fromUint8Array(bytes)}\``,
  `const url = \`data:\${mime};base64,\${fromUint8Array(bytes)}\`.length`,
  `const css = \`url("data:image/svg+xml,\${encodeURIComponent(svg)}") 12 12, auto\``,
  "const url = 'data:image/png;base64,' + fromUint8Array(bytes)",
  "const url = 'data:' + mime + ';base64,' + fromUint8Array(bytes)",
  `const css = \`url( "data:image/svg+xml,\${encodeURIComponent(svg)}")\``,
  `const src = \` data:image/png;base64,\${fromUint8Array(bytes)}\``,
  "value.startsWith('data:image/')"
]
const accepted = [
  `const url = \`data:image/png;base64,\${encoded}\``,
  "const url = 'data:image/png;base64,' + encoded",
  "line.startsWith('data: ')",
  "line.startsWith('data:')",
  `log(\`  data: \${encodeURIComponent(name)}\`)`,
  `const css = \`url("\\u00a0data:icons/\${encodeURIComponent(name)}")\``,
  `const link = \`https://example.com/\${encodeURIComponent(name)}\``,
  "const link = 'https://example.com/' + encodeURIComponent(name)"
]

describe('@open-pencil/data/no-hand-rolled-data-url', () => {
  test('reports hand-built and hand-matched data URLs once each, in one Oxlint run', async () => {
    const cases = [...rejected, ...accepted]
    const sources = Object.fromEntries(
      cases.map((source, index) => [`src/case-${index}.ts`, `${source}\n`])
    )
    const diagnostics = ruleDiagnostics(await lintFiles(sources, rules), rule)
    const counts = cases.map(
      (_, index) => diagnostics.filter((item) => item.filename?.endsWith(`case-${index}.ts`)).length
    )
    expect(counts).toEqual([...rejected.map(() => 1), ...accepted.map(() => 0)])
  })
})
