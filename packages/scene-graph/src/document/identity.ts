const MAX_GUID_PART = 0xffff_ffff

/** Experimental Figma-compatible allocator; existing identities must be retained on reload. */
export function createSessionIdGenerator(sessionId = randomSessionId()): () => string {
  if (!Number.isInteger(sessionId) || sessionId <= 0 || sessionId > MAX_GUID_PART) {
    throw new RangeError('Session ID must be a nonzero uint32')
  }
  let localId = 1
  return () => {
    if (localId > MAX_GUID_PART) throw new RangeError('Session ID allocator exhausted')
    return `${sessionId}:${localId++}`
  }
}

function randomSessionId(): number {
  const words = new Uint32Array(1)
  do {
    crypto.getRandomValues(words)
  } while (words[0] === 0)
  return words[0]
}
