import { isTauri } from '@/app/tauri/env'

/**
 * Vectorize providers (Recraft, fal) call third-party APIs that only whitelist
 * the web dev origin (http://localhost:1420) for CORS — the desktop webview
 * origin (tauri://localhost) is rejected, so a direct browser fetch fails with a
 * TypeError. In the desktop app, route requests through Tauri's HTTP plugin,
 * which issues them from Rust with no browser Origin, bypassing CORS entirely.
 * In the web build, fall back to the platform fetch (CORS-allowed there).
 */
export async function vectorizeFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch(input, init)
  }
  return globalThis.fetch(input, init)
}
