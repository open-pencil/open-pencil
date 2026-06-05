function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function fetchSvgFromUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download vectorized SVG (${response.status})`)
  }
  return response.text()
}

function readUrlField(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  if (!('url' in value)) return null
  const url = value.url
  return typeof url === 'string' && url.length > 0 ? url : null
}

function extractSvgUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null

  const fromImage = 'image' in payload ? readUrlField(payload.image) : null
  if (fromImage) return fromImage

  if ('images' in payload && Array.isArray(payload.images) && payload.images.length > 0) {
    const fromImages = readUrlField(payload.images[0])
    if (fromImages) return fromImages
  }

  if ('data' in payload) {
    const nested = extractSvgUrl(payload.data)
    if (nested) return nested
  }

  return readUrlField(payload)
}

export async function recraftVectorize(pngBytes: Uint8Array, apiKey: string): Promise<string> {
  const form = new FormData()
  const blob = new Blob([toArrayBuffer(pngBytes)], { type: 'image/png' })
  form.append('file', blob, 'image.png')

  const response = await fetch('https://external.api.recraft.ai/v1/images/vectorize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      detail
        ? `Recraft vectorize failed (${response.status}): ${detail}`
        : `Recraft vectorize failed (${response.status})`
    )
  }

  const payload = await response.json()
  const url = extractSvgUrl(payload)
  if (!url) throw new Error('Recraft vectorize returned no image URL')
  return fetchSvgFromUrl(url)
}

export async function falVectorize(pngBytes: Uint8Array, apiKey: string): Promise<string> {
  const dataUri = `data:image/png;base64,${bytesToBase64(pngBytes)}`
  const response = await fetch('https://fal.run/fal-ai/recraft/vectorize', {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ image_url: dataUri })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      detail
        ? `fal vectorize failed (${response.status}): ${detail}`
        : `fal vectorize failed (${response.status})`
    )
  }

  const payload = await response.json()
  const url = extractSvgUrl(payload)
  if (!url) throw new Error('fal vectorize returned no image URL')
  return fetchSvgFromUrl(url)
}
