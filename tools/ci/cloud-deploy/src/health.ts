/**
 * The routes a deployment must answer, and how each is asked for: pages as a browser asks, the API
 * as a client does, so a missing API route can't turn into the editor's page.
 */
export const HEALTH_ROUTES = [
  { path: '/health', accept: 'application/json' },
  { path: '/ready', accept: 'application/json' },
  { path: '/.well-known/openpencil', accept: 'application/json' },
  { path: '/', accept: 'text/html' },
  { path: '/welcome', accept: 'text/html' },
  { path: '/auth/sign-in', accept: 'text/html' }
] as const

export interface HealthOptions {
  attempts?: number
  delayMs?: number
  fetch?: typeof fetch
}

/** The status a route answers with, retried while the request fails or the answer is not 200. */
async function routeStatus(
  url: string,
  accept: string,
  { attempts = 11, delayMs = 3000, fetch: get = fetch }: HealthOptions
): Promise<string> {
  let status = ''
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await get(url, { headers: { accept }, redirect: 'manual' })
      await response.body?.cancel()
      if (response.status === 200) return '200'
      status = `HTTP ${response.status}`
    } catch (error) {
      status = error instanceof Error ? error.message : String(error)
    }
    if (attempt < attempts) await Bun.sleep(delayMs)
  }
  return status
}

/**
 * Checks that a deployment answers every route with 200. A redirect counts as a failure, since one
 * to a sign-in or access page would mean the Worker isn't there.
 */
export async function checkDeployment(baseURL: string, options: HealthOptions = {}) {
  const failures: string[] = []
  for (const { path, accept } of HEALTH_ROUTES) {
    const status = await routeStatus(new URL(path, baseURL).href, accept, options)
    if (status !== '200') failures.push(`${path} answered ${status}`)
  }
  return failures
}

if (import.meta.main) {
  const baseURL = process.argv[2]
  if (!baseURL) throw new Error('Usage: health.ts <deployment URL>')
  const failures = await checkDeployment(baseURL)
  for (const failure of failures) console.log(`::error::${failure}`)
  if (failures.length > 0) process.exit(1)
  console.log(`${baseURL} answered every route`)
}
