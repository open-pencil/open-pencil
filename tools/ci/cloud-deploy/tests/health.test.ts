import { expect, test } from 'bun:test'

import { checkDeployment, HEALTH_ROUTES } from '#cloud-deploy/health'

type Answer = number | Error

function server(answers: Record<string, Answer[]>) {
  const requests: { path: string; accept: string | null; redirect?: RequestRedirect }[] = []
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input)
    requests.push({
      path: url.pathname,
      accept: new Headers(init?.headers).get('accept'),
      redirect: init?.redirect
    })
    const answer = answers[url.pathname]?.shift() ?? 200
    if (answer instanceof Error) throw answer
    return new Response(null, { status: answer })
  }) as typeof globalThis.fetch
  return { fetch, requests }
}

test('passes when every route answers 200, asking pages as a browser does', async () => {
  const { fetch, requests } = server({})
  expect(await checkDeployment('https://cloud.example', { fetch, delayMs: 0 })).toEqual([])
  expect(requests.map((request) => request.path)).toEqual(HEALTH_ROUTES.map((route) => route.path))
  expect(requests.find((request) => request.path === '/')?.accept).toBe('text/html')
  expect(requests.find((request) => request.path === '/health')?.accept).toBe('application/json')
  expect(requests.every((request) => request.redirect === 'manual')).toBe(true)
})

test('retries a route until it answers 200', async () => {
  const { fetch } = server({ '/ready': [new Error('connection reset'), 503] })
  expect(await checkDeployment('https://cloud.example', { fetch, delayMs: 0 })).toEqual([])
})

test('reports a route that keeps redirecting or failing', async () => {
  const { fetch } = server({
    '/welcome': [302, 302, 302],
    '/health': [new Error('refused'), new Error('refused'), new Error('refused')]
  })
  expect(
    await checkDeployment('https://cloud.example', { fetch, delayMs: 0, attempts: 3 })
  ).toEqual(['/health answered refused', '/welcome answered HTTP 302'])
})
