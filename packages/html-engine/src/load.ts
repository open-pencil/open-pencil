import { HTMLEngine } from './engine'

/**
 * Where the engine's module (`html-engine.wasm`) loads from. By default it is read beside this
 * package, as Node and Bun resolve it; a host that serves it elsewhere, such as a bundled app,
 * points here instead.
 */
export type HTMLEngineLocator = () => string

let locator: HTMLEngineLocator = () =>
  import.meta.resolve('@open-pencil/html-engine/wasm/html-engine.wasm')

let loading: Promise<HTMLEngine> | null = null

/**
 * How long a remote module may take to arrive, so a request that never settles cannot hold every
 * later load waiting on it; a failed load is retried by the next caller.
 */
const MODULE_LOAD_TIMEOUT_MS = 60_000

/** Points the engine at the host's copy of its module. Call before the first `loadHTMLEngine`. */
export function setHTMLEngineLocator(locate: HTMLEngineLocator): void {
  locator = locate
  loading = null
}

async function readModule(url: string): Promise<ArrayBuffer> {
  if (!url.startsWith('file:')) {
    const response = await fetch(url, { signal: AbortSignal.timeout(MODULE_LOAD_TIMEOUT_MS) })
    if (!response.ok)
      throw new Error(`html-engine.wasm failed to load from ${url}: ${response.status}`)
    return response.arrayBuffer()
  }
  const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
  const file = await readFile(new URL(url)).catch((error: unknown) => {
    throw new Error(
      `html-engine.wasm is missing at ${url}; build it with bun run build in packages/html-engine`,
      { cause: error }
    )
  })
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
}

/** The engine, loaded once; a failed load is retried by the next caller. */
export function loadHTMLEngine(): Promise<HTMLEngine> {
  if (loading) return loading
  const load = readModule(locator()).then((bytes) => HTMLEngine.instantiate(bytes))
  loading = load
  load.catch(() => {
    if (loading === load) loading = null
  })
  return load
}
