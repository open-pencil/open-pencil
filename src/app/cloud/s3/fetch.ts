import { isTauri } from '@/app/tauri/env'

/** Prefer Tauri HTTP bridge on desktop to avoid bucket CORS requirements. */
export async function cloudFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    const { tauriFetch } = await import('@/app/tauri/http')
    return tauriFetch(input, init)
  }
  return fetch(input, init)
}
