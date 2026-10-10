import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

import { isCloudPortalPage } from '#cloud/contract'
import { getMimeType } from 'hono/utils/mime'

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
  // Desktop sign-in approval must never be framed by another site.
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
}

function decodedPath(request: Request): string | null {
  try {
    return decodeURIComponent(new URL(request.url).pathname)
  } catch {
    return null
  }
}

/**
 * Serves a built Cloud portal (`bun run build:cloud-portal`) from `directory`: `cloud.html` for
 * portal pages, and its hashed assets and icons for paths the API does not answer.
 */
export function createNodeCloudPortal(directory: string) {
  const root = resolve(directory)

  async function read(path: string) {
    const file = resolve(root, `.${path}`)
    if (!file.startsWith(`${root}${sep}`)) return null
    try {
      return await readFile(file)
    } catch {
      return null
    }
  }

  return {
    /** The portal page for `request`, or null when it is not one. */
    async page(request: Request): Promise<Response | null> {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null
      if (!isCloudPortalPage(new URL(request.url).pathname)) return null
      const page = await read('/cloud.html')
      return page ? new Response(page, { headers: PAGE_HEADERS }) : null
    },

    /** A portal file for `request`, or null when there is none. */
    async file(request: Request): Promise<Response | null> {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null
      const path = decodedPath(request)
      if (!path || path === '/cloud.html') return null
      const type = getMimeType(path)
      const body = type ? await read(path) : null
      if (!type || !body) return null
      return new Response(body, {
        headers: {
          'Content-Type': type,
          'Cache-Control': path.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff'
        }
      })
    }
  }
}
