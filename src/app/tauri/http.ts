interface ProxyHttpHeader {
  name: string
  value: string
}

interface ProxyHttpRequest {
  url: string
  method?: string
  headers?: ProxyHttpHeader[]
  body?: number[]
}

interface ProxyHttpResponse {
  status: number
  headers: ProxyHttpHeader[]
  body: number[]
}

function headersToProxyHeaders(headers: Headers): ProxyHttpHeader[] {
  return [...headers.entries()].map(([name, value]) => ({ name, value }))
}

async function bodyToBytes(body: BodyInit | null | undefined): Promise<number[] | undefined> {
  if (body == null) return undefined
  if (typeof body === 'string') return [...new TextEncoder().encode(body)]
  if (body instanceof ArrayBuffer) return [...new Uint8Array(body)]
  if (ArrayBuffer.isView(body))
    return [...new Uint8Array(body.buffer, body.byteOffset, body.byteLength)]
  if (body instanceof Blob) return [...new Uint8Array(await body.arrayBuffer())]
  if (body instanceof URLSearchParams) return [...new TextEncoder().encode(body.toString())]
  if (body instanceof FormData) {
    return [...new Uint8Array(await new Response(body).arrayBuffer())]
  }
  throw new TypeError('Streaming request bodies are not supported by the desktop HTTP bridge yet')
}

export async function tauriFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init)
  const { invoke } = await import('@tauri-apps/api/core')
  const payload: ProxyHttpRequest = {
    url: request.url,
    method: request.method,
    headers: headersToProxyHeaders(request.headers),
    body: await bodyToBytes(init?.body)
  }
  const response = await invoke<ProxyHttpResponse>('proxy_http_request', { request: payload })
  return new Response(new Uint8Array(response.body), {
    status: response.status,
    headers: response.headers.map(({ name, value }): [string, string] => [name, value])
  })
}
