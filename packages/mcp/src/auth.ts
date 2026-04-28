export function bearerToken(header: string | undefined | null): string | null {
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

export function mcpRequestToken(
  authorization: string | undefined | null,
  headerToken: string | undefined | null,
): string | null {
  return bearerToken(authorization) ?? headerToken ?? null
}

export function isAuthorized(provided: string | null, expected: string | null): boolean {
  return expected === null || provided === expected
}
