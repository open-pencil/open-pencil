import type { Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { MAX_FILE_TRANSFER_BYTES, readInsideRoot, writeInsideRoot } from '#mcp/tool/output'

/**
 * The path after `/files/`, one encoded segment per folder, so the URL ends in the file's name.
 * Empty segments keep a POSIX root (`/files//Users/…`) and a Windows share (`/files///server/…`).
 * Decoded from the raw URL, since the router's path is already partly decoded.
 */
function filePath(c: Context): string {
  const pathname = new URL(c.req.url).pathname
  return pathname.slice('/files/'.length).split('/').map(decodeURIComponent).join('/')
}

function failure(c: Context, e: unknown) {
  return c.json({ error: e instanceof Error ? e.message : String(e) }, 400)
}

/**
 * A browser app cannot reach the paths the file tools name, so it reads and writes them through
 * `/files/`, inside the same root the tools resolve them in. The caller guards the route with the
 * server's token.
 */
export function registerFileRoutes(app: Hono, root: string): void {
  app.get('/files/*', async (c) => {
    try {
      const bytes = await readInsideRoot(filePath(c), root)
      return c.body(bytes, 200, { 'content-type': 'application/octet-stream' })
    } catch (e) {
      return failure(c, e)
    }
  })
  app.put(
    '/files/*',
    bodyLimit({
      maxSize: MAX_FILE_TRANSFER_BYTES,
      onError: (c) => c.json({ error: 'File is too large' }, 413)
    }),
    async (c) => {
      try {
        const bytes = new Uint8Array(await c.req.arrayBuffer())
        return c.json(await writeInsideRoot(filePath(c), root, bytes))
      } catch (e) {
        return failure(c, e)
      }
    }
  )
}
