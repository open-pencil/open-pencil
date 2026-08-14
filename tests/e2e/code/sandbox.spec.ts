import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

async function evaluate(page: Page, source: string, timeoutMs = 1_000) {
  return page.evaluate(
    async ({ source, timeoutMs }) => {
      const { evaluateDesignJSX } = await import('@/app/code/sandbox/evaluate')
      return evaluateDesignJSX(source, { timeoutMs })
    },
    { source, timeoutMs }
  )
}

test('evaluates JSX into plain inert data', async ({ page }) => {
  const result = await evaluate(
    page,
    '<Frame w={320} fill={solid("#fff")}><Text>Hello</Text></Frame>'
  )

  expect(result).toEqual({
    ok: true,
    roots: [
      {
        type: 'frame',
        props: {
          w: 320,
          fill: { __openPencilHelper: 'solid', args: ['#fff'] }
        },
        children: [{ type: 'text', props: {}, children: ['Hello'] }]
      }
    ]
  })
})

test('cannot access the parent or application origin', async ({ page }) => {
  const result = await evaluate(page, '<Frame>{String(window.parent.document)}</Frame>')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toContain('window is not defined')
})

test('blocks network requests from evaluated code', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('sandbox-probe.invalid')) requests.push(request.url())
  })
  const result = await evaluate(
    page,
    '<Frame>{fetch("https://sandbox-probe.invalid/leak")}</Frame>'
  )
  expect(result.ok).toBe(false)
  expect(requests).toEqual([])
})

test('terminates accidental infinite loops without freezing the host', async ({ page }) => {
  const started = Date.now()
  const result = await evaluate(page, '(() => { while (true) {} })()', 100)
  expect(result).toEqual({ ok: false, error: 'Design JSX execution timed out.' })
  expect(Date.now() - started).toBeLessThan(2_000)
  await expect(page.getByTestId('editor-root')).toBeVisible()
})

test('rejects oversized source and output', async ({ page }) => {
  const sourceResult = await page.evaluate(async () => {
    const { evaluateDesignJSX } = await import('@/app/code/sandbox/evaluate')
    return evaluateDesignJSX('<Text>too large</Text>', { sourceBytes: 4 })
  })
  expect(sourceResult).toEqual({ ok: false, error: 'Design JSX source is too large.' })

  const outputResult = await page.evaluate(async () => {
    const { evaluateDesignJSX } = await import('@/app/code/sandbox/evaluate')
    return evaluateDesignJSX('<Text>{"x".repeat(100)}</Text>', { outputBytes: 20 })
  })
  expect(outputResult).toEqual({ ok: false, error: 'Design JSX output is too large.' })
})
