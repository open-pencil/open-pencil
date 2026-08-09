import type { DownloadProgress } from '@/app/integrations/storage/types'

/**
 * Read a response body to completion, reporting bytes as they arrive.
 *
 * Every provider client streams downloads the same way and for the same
 * reason: a large `.fig` is the one transfer long enough that silence reads as
 * a hang. Only the header parsing differs between them, so that stays at the
 * call site and the loop lives here.
 *
 * `content-length` is advisory — a chunked or compressed response has none, and
 * a total of `null` means "unknown", not "zero".
 */
export async function readBodyWithProgress(
  body: ReadableStream<Uint8Array>,
  totalBytes: number | null,
  onProgress: (progress: DownloadProgress) => void
): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    receivedBytes += value.byteLength
    onProgress({ receivedBytes, totalBytes })
  }

  const out = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * A declared, positive `content-length`, or `null` for "unknown".
 *
 * Zero counts as unknown deliberately: consumers divide received by total to
 * get a fraction, and a declared 0 would hand them NaN. A body that really is
 * empty yields no chunks, so no progress is reported either way.
 */
export function declaredContentLength(headers: Headers): number | null {
  const header = headers.get('content-length')
  if (header === null) return null
  const length = Number(header)
  return Number.isFinite(length) && length > 0 ? length : null
}
