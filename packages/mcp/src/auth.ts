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

  const providedDigest = createHash('sha256').update(provided, 'utf8').digest()
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}
