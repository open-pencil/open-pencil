export interface BoundedBodyOptions {
  /** Aborts the underlying request when the body exceeds the cap. */
  onExceeded?: () => void
  /** Error message for an oversized body; defaults to the MiB figure. */
  sizeError?: string
}

function oversizedBody(maxBytes: number): string {
  return `exceeds ${Math.floor(maxBytes / (1024 * 1024))} MiB`
}

/**
 * Reads a response body, aborting as soon as it exceeds `maxBytes`. The body is counted
 * chunk by chunk as it streams in: `Content-Length` is the sender's claim, absent on a
 * chunked response and free to lie on any other, so it is only a cheap early exit and
 * the cap itself is enforced on the bytes that actually arrive. `onExceeded` cancels the
 * request instead of draining the rest of an oversized body.
 */
export async function readBoundedBody(
  response: Response,
  maxBytes: number,
  { onExceeded, sizeError }: BoundedBodyOptions = {}
): Promise<Uint8Array<ArrayBuffer>> {
  const fail = (): never => {
    onExceeded?.()
    throw new Error(sizeError ?? oversizedBody(maxBytes))
  }

  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) fail()

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) fail()
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) fail()
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
