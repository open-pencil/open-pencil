import { createHash, timingSafeEqual } from 'node:crypto'

export function bearerToken(header: string | undefined | null): string | null {
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

export function mcpRequestToken(
  authorization: string | undefined | null,
  headerToken: string | undefined | null
): string | null {
  return bearerToken(authorization) ?? headerToken ?? null
}

export function isAuthorized(provided: string | null, expected: string | null): boolean {
  if (expected === null) return true
  if (provided === null) return false

  // Hash both strings to fixed-length digests so timingSafeEqual always
  // compares equal-length buffers, regardless of input token length.
  const a = createHash('sha256').update(provided, 'utf-8').digest()
  const b = createHash('sha256').update(expected, 'utf-8').digest()
  return timingSafeEqual(a, b)
}
