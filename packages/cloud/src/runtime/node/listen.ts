import { createServer } from 'node:http'

import { getRequestListener } from '@hono/node-server'

/** Serves a fetch handler over Node HTTP and resolves once the port is bound. */
export async function listen(
  fetch: (request: Request) => Promise<Response>,
  port: number,
  hostname: string
) {
  const listener = getRequestListener(fetch)
  const server = createServer((request, response) => {
    void listener(request, response)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, hostname, () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  const boundPort = typeof address === 'object' && address ? address.port : port
  return {
    url: new URL(`http://localhost:${boundPort}`),
    http: server,
    close: () =>
      new Promise<void>((done, fail) => {
        server.close((error) => {
          if (error) fail(error)
          else done()
        })
      })
  }
}
