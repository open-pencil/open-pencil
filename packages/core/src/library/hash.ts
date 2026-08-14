const textEncoder = new TextEncoder()

function canonicalize(value: unknown): unknown {
  if (value instanceof Uint8Array) return { $bytes: [...value] }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => {
          if (left < right) return -1
          if (left > right) return 1
          return 0
        })
        .map(([key, entry]) => [key, canonicalize(entry)])
    )
  }
  return value
}

export function canonicalJSONString(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function contentHash(value: unknown): Promise<string> {
  if (typeof crypto === 'undefined') {
    throw new TypeError('Web Crypto is required to hash library content')
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(canonicalJSONString(value))
  )
  return toHex(new Uint8Array(digest))
}
