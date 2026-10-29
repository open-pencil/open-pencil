import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

async function diagnostics(rule: string, source: string) {
  return ruleDiagnostics(await lint(source, { [`open-pencil/${rule}`]: 'error' }), rule)
}

describe('no-cloud-dynamic-html', () => {
  test.each(['c.html(page)', 'c.html(`<p>` + name + `</p>`)', "c.html('<p>' + name + '</p>')"])(
    'rejects %s',
    async (source) => {
      expect(await diagnostics('no-cloud-dynamic-html', source)).toHaveLength(1)
    }
  )

  test.each(["c.html('<p>Done</p>')", 'c.html(`<p>Done</p>`, 200)', 'c.json(body)'])(
    'accepts %s',
    async (source) => {
      expect(await diagnostics('no-cloud-dynamic-html', source)).toHaveLength(0)
    }
  )
})

describe('no-cloud-secret-in-query', () => {
  test.each([
    "url.searchParams.set('secret', value)",
    "url.searchParams.append('token', value)",
    "new URL(base).searchParams.set('token', value)",
    'new URLSearchParams({ token })',
    "new URLSearchParams({ 'secret': value })",
    `fetch(\`\${base}/share?token=\${value}\`)`
  ])('rejects %s', async (source) => {
    expect(await diagnostics('no-cloud-secret-in-query', source)).toHaveLength(1)
  })

  test.each([
    "url.searchParams.set('server', value)",
    'url.hash = secret',
    "headers.set('token', value)",
    'new URLSearchParams({ server })',
    `fetch(\`\${base}/share#secret=\${value}\`)`
  ])('accepts %s', async (source) => {
    expect(await diagnostics('no-cloud-secret-in-query', source)).toHaveLength(0)
  })
})

describe('no-cloud-secret-logging', () => {
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
    expect(await diagnostics('no-cloud-secret-logging', source)).toHaveLength(1)
  })

  test.each([
    "console.error('[Cloud] Email worker failed:', error)",
    'console.log(documentId)',
    'logger.info(token)',
    'console.log(tokenCount)',
    `console.log(\`\${tokenizer.name}\`)`,
    'console.log({ documentId, size })'
  ])('accepts %s', async (source) => {
    expect(await diagnostics('no-cloud-secret-logging', source)).toHaveLength(0)
  })
})
