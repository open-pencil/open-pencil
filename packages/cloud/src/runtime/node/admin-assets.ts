import { open } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

function isAdminPage(pathname: string): boolean {
  return pathname === '/join' || pathname === '/admin' || pathname.startsWith('/admin/')
}

export function createNodeAdminAssetHandler(directory: string) {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    if (!isAdminPage(url.pathname) && !url.pathname.startsWith('/assets/')) return null
    const relative = isAdminPage(url.pathname) ? 'index.html' : url.pathname.slice(1)
    const safePath = normalize(relative)
    if (safePath.startsWith('..')) return new Response('Not found', { status: 404 })
    const path = join(directory, safePath)
    let file
    try {
      file = await open(path, 'r')
      if (!(await file.stat()).isFile()) return new Response('Not found', { status: 404 })
      return new Response(await file.readFile(), {
        headers: {
          'Content-Type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
          'Cache-Control':
            relative === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
        }
      })
    } catch {
      return new Response('Admin UI is not built', { status: 503 })
    } finally {
      await file?.close()
    }
  }
}
