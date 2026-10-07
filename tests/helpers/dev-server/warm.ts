import type { FullConfig } from '@playwright/test'

/** Requests in flight at once; Vite transforms each module on first request. */
const CONCURRENCY = 8
/** Every import specifier Vite rewrites to a served URL: static, side-effect, and dynamic. */
const IMPORT_URL = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\/[^"']+)["']/g

/**
 * Compiles the app on the dev server before any test runs. The server transforms each module on
 * its first request, so on a slow runner the first test to open the canvas, chat, or settings
 * spent its time budget compiling them. This walks the module graph from the entry the way the
 * browser does, following dynamic imports too, so every test starts on a warm server.
 */
export default async function warmDevServer(config: FullConfig): Promise<void> {
  const baseURL = config.projects.find((project) => project.name === 'openpencil')?.use.baseURL
  if (!baseURL) return
  // A run that started only the Storybook server has no app server to warm.
  const reachable = await fetch(baseURL).then(
    (response) => response.ok,
    () => false
  )
  if (!reachable) return

  const started = performance.now()
  const seen = new Set<string>(['/src/main.ts'])
  const queue = ['/src/main.ts']
  const worker = async () => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      const response = await fetch(new URL(path, baseURL))
      if (!response.ok || !/javascript/.test(response.headers.get('content-type') ?? '')) continue
      for (const [, imported] of (await response.text()).matchAll(IMPORT_URL)) {
        if (seen.has(imported)) continue
        seen.add(imported)
        queue.push(imported)
      }
    }
  }
  // Workers stop when the queue runs dry, so keep starting rounds until no module is left.
  while (queue.length > 0) await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  process.stdout.write(`Warmed the dev server: ${seen.size} modules in ${seconds}s\n`)
}
