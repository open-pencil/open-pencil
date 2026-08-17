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

test('supports local constants, function components, arrays, and conditionals', async ({
  page
}) => {
  const result = await evaluate(
    page,
    `const colors = { surface: '#fff' }
const Card = ({ title, visible }) => (
  <Frame fill={colors.surface}>
    {visible ? <Text>{title}</Text> : null}
    {[1, 2].map((item) => <Text>{item}</Text>)}
  </Frame>
)
<Card title="Hello" visible />`
  )

  expect(result).toEqual({
    ok: true,
    roots: [
      {
        type: 'frame',
        props: { fill: '#fff' },
        children: [
          { type: 'text', props: {}, children: ['Hello'] },
          { type: 'text', props: {}, children: [1] },
          { type: 'text', props: {}, children: [2] }
        ]
      }
    ]
  })
})

test('converts variable helpers without executing host capabilities', async ({ page }) => {
  const result = await evaluate(
    page,
    `const vars = defineVars({ primary: { name: 'Primary', value: '#ff0000' } })
<Frame fill={vars.primary}><Text color={designVar('text', '#000')}>Hello</Text></Frame>`
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.roots[0]).toMatchObject({
    type: 'frame',
    props: {
      fill: { __openPencilHelper: 'designVar' }
    }
  })
})

test('supports multiple roots through fragments', async ({ page }) => {
  const result = await evaluate(page, '<><Rectangle name="One" /><Ellipse name="Two" /></>')
  expect(result).toEqual({
    ok: true,
    roots: [
      { type: 'rectangle', props: { name: 'One' }, children: [] },
      { type: 'ellipse', props: { name: 'Two' }, children: [] }
    ]
  })
})

test('cannot access the parent or application origin', async ({ page }) => {
  const result = await evaluate(page, '<Frame>{String(window.parent.document)}</Frame>')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toMatch(/window is not defined|Can't find variable: window/)
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
