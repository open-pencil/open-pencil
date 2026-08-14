import { expect, test, type Page } from '@playwright/test'

import type { evaluateDesignJSX as EvaluateDesignJSX } from '@/app/code/sandbox/evaluate'

import { CanvasHelper } from '#tests/helpers/canvas'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

async function evaluate(page: Page, source: string, timeoutMs = 1_000) {
  return page.evaluate(
    async ({ source, timeoutMs }) => {
      const modulePath = '/src/app/code/sandbox/evaluate.ts'
      const { evaluateDesignJSX } = (await import(/* @vite-ignore */ modulePath)) as {
        evaluateDesignJSX: typeof EvaluateDesignJSX
      }
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
    const modulePath = '/src/app/code/sandbox/evaluate.ts'
    const { evaluateDesignJSX } = (await import(/* @vite-ignore */ modulePath)) as {
      evaluateDesignJSX: typeof EvaluateDesignJSX
    }
    return evaluateDesignJSX('<Text>too large</Text>', { sourceBytes: 4 })
  })
  expect(sourceResult).toEqual({ ok: false, error: 'Design JSX source is too large.' })

  const outputResult = await page.evaluate(async () => {
    const modulePath = '/src/app/code/sandbox/evaluate.ts'
    const { evaluateDesignJSX } = (await import(/* @vite-ignore */ modulePath)) as {
      evaluateDesignJSX: typeof EvaluateDesignJSX
    }
    return evaluateDesignJSX('<Text>{"x".repeat(100)}</Text>', { outputBytes: 20 })
  })
  expect(outputResult).toEqual({ ok: false, error: 'Design JSX output is too large.' })

  const arrayResult = await page.evaluate(async () => {
    const modulePath = '/src/app/code/sandbox/evaluate.ts'
    const { evaluateDesignJSX } = (await import(/* @vite-ignore */ modulePath)) as {
      evaluateDesignJSX: typeof EvaluateDesignJSX
    }
    return evaluateDesignJSX(
      '<Frame>{Array.from({ length: 10 }, (_, i) => <Text>{i}</Text>)}</Frame>',
      {
        arrayLength: 5
      }
    )
  })
  expect(arrayResult).toEqual({
    ok: false,
    error: 'Design JSX output contains an array that is too long.'
  })
})
