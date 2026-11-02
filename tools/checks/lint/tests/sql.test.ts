import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

async function diagnostics(source: string) {
  return ruleDiagnostics(await lint(source, { 'open-pencil/no-raw-sql': 'error' }), 'no-raw-sql')
}

describe('no-raw-sql', () => {
  test.each(['sql`select 1`', 'sql.raw`drop table x`', 'sql<number>`count(*)`'])(
    'rejects %s',
    async (source) => {
      expect(await diagnostics(source)).toHaveLength(1)
    }
  )

  test.each(["db.selectFrom('documents').selectAll()", 'html`<p></p>`'])(
    'accepts %s',
    async (source) => {
      expect(await diagnostics(source)).toHaveLength(0)
    }
  )
})
