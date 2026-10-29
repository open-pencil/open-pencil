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
        children: [{ type: 'text', props: {}, children: ['Hello'], source: 1 }],
        source: 1
      }
    ],
    collections: [],
    lineOffset: 0
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
return <Card title="Hello" visible />`
  )

  // Elements carry the line they were written on; the offset maps it to the source.
  expect(result).toEqual({
    ok: true,
    roots: [
      {
        type: 'frame',
        props: { fill: '#fff' },
        children: [
          { type: 'text', props: {}, children: ['Hello'], source: 4 },
          { type: 'text', props: {}, children: [1], source: 5 },
          { type: 'text', props: {}, children: [2], source: 5 }
        ],
        source: 3
      }
    ],
    collections: [],
    lineOffset: 0
  })
})

test('writes each defineVars() collection once, with the modes defineMode() adds', async ({
  page
}) => {
  const result = await evaluate(
    page,
    `const theme = defineVars('Theme', { Page: '#ffffff', Text: '#111111' }, { mode: 'Light' })
const dark = defineMode(theme, 'Dark', { Page: '#111111', Text: theme.Page })
return <Frame mode={dark} fill={theme.Page}><Text color={designVar('Ink')}>Hello</Text></Frame>`
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.collections).toEqual([
    {
      collection: 'Theme',
      values: { Page: '#ffffff', Text: '#111111' },
      options: { mode: 'Light' },
      modes: [
        {
          mode: 'Dark',
          values: { Page: '#111111', Text: { __openPencilHelper: 'variable', args: [0, 'Page'] } }
        }
      ]
    }
  ])
  expect(result.roots[0]).toMatchObject({
    type: 'frame',
    props: {
      mode: { __openPencilHelper: 'mode', args: [0, 'Dark'] },
      fill: { __openPencilHelper: 'variable', args: [0, 'Page'] }
    }
  })
})

test('numbers each ref() so a layer and the ends that refer to it share it', async ({ page }) => {
  const result = await evaluate(
    page,
    `const left = ref()
const right = ref()
return <Frame>
  <Frame name="Card" ref={left} />
  <Frame name="Card" ref={right} />
  <Connector from={left} to={right} />
</Frame>`
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return
  const ref = (number: number) => ({ __openPencilHelper: 'ref', args: [number] })
  expect(result.roots[0]).toMatchObject({
    children: [
      { props: { ref: ref(1) } },
      { props: { ref: ref(2) } },
      { type: 'connector', props: { from: ref(1), to: ref(2) } }
    ]
  })
})

test('supports multiple roots through fragments', async ({ page }) => {
  const result = await evaluate(page, '<><Rectangle name="One" /><Ellipse name="Two" /></>')
  expect(result).toEqual({
    ok: true,
    roots: [
      { type: 'rectangle', props: { name: 'One' }, children: [], source: 1 },
      { type: 'ellipse', props: { name: 'Two' }, children: [], source: 1 }
    ],
    collections: [],
    lineOffset: 0
  })
})

test('evaluates behaviour parts named through their namespace', async ({ page }) => {
  const result = await evaluate(page, '<Switch.Root name="Toggle"><Switch.Thumb /></Switch.Root>')
  expect(result).toMatchObject({
    ok: true,
    roots: [{ type: 'Switch.Root', children: [{ type: 'Switch.Thumb' }] }]
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
