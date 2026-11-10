import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

async function diagnostics(rule: string, source: string) {
  return ruleDiagnostics(await lint(source, { [rule]: 'error' }), rule)
}

describe('@open-pencil/security/no-dynamic-html', () => {
  test.each(['c.html(page)', 'c.html(`<p>` + name + `</p>`)', "c.html('<p>' + name + '</p>')"])(
    'rejects %s',
    async (source) => {
      expect(await diagnostics('@open-pencil/security/no-dynamic-html', source)).toHaveLength(1)
    }
  )

  test.each(["c.html('<p>Done</p>')", 'c.html(`<p>Done</p>`, 200)', 'c.json(body)'])(
    'accepts %s',
    async (source) => {
      expect(await diagnostics('@open-pencil/security/no-dynamic-html', source)).toHaveLength(0)
    }
  )
})

describe('@open-pencil/security/no-secret-in-query', () => {
  test.each([
    "url.searchParams.set('secret', value)",
    "url.searchParams.append('token', value)",
    "new URL(base).searchParams.set('token', value)",
    'new URLSearchParams({ token })',
    "new URLSearchParams({ 'secret': value })",
    `fetch(\`\${base}/share?token=\${value}\`)`
  ])('rejects %s', async (source) => {
    expect(await diagnostics('@open-pencil/security/no-secret-in-query', source)).toHaveLength(1)
  })

  test.each([
    "url.searchParams.set('server', value)",
    'url.hash = secret',
    "headers.set('token', value)",
    'new URLSearchParams({ server })',
    `fetch(\`\${base}/share#secret=\${value}\`)`
  ])('accepts %s', async (source) => {
    expect(await diagnostics('@open-pencil/security/no-secret-in-query', source)).toHaveLength(0)
  })
})

describe('@open-pencil/security/no-secret-logging', () => {
  test.each([
    'console.log(token)',
    "console.error('[Cloud]', session.accessToken)",
    "console.warn(request.headers['cookie'])",
    'console.debug(shareSecret)',
    'console.info(authorization)',
    `console.log(\`token=\${token}\`)`,
    'console.log({ token })',
    'console.log({ sessionCookie: value })',
    "console.log('x: ' + session.accessToken)",
    'console.log(...[token])'
  ])('rejects %s', async (source) => {
    expect(await diagnostics('@open-pencil/security/no-secret-logging', source)).toHaveLength(1)
  })

  test.each([
    "console.error('[Cloud] Email worker failed:', error)",
    'console.log(documentId)',
    'logger.info(token)',
    'console.log(tokenCount)',
    `console.log(\`\${tokenizer.name}\`)`,
    'console.log({ documentId, size })'
  ])('accepts %s', async (source) => {
    expect(await diagnostics('@open-pencil/security/no-secret-logging', source)).toHaveLength(0)
  })
})

describe('@open-pencil/security/no-unvalidated-route-params', () => {
  test.each(["context.req.param('documentId')", 'c.req.param()', "c.req['param']('id')"])(
    'rejects %s',
    async (source) => {
      expect(
        await diagnostics('@open-pencil/security/no-unvalidated-route-params', source)
      ).toHaveLength(1)
    }
  )

  test.each(["context.req.valid('param').documentId", "c.req.query('page')", "url.param('id')"])(
    'accepts %s',
    async (source) => {
      expect(
        await diagnostics('@open-pencil/security/no-unvalidated-route-params', source)
      ).toHaveLength(0)
    }
  )
})
