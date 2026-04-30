export function randomHex(bytes = 16): string {
  if (!Number.isInteger(bytes) || bytes < 0) {
    throw new RangeError('bytes must be a non-negative integer')
  }
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  let hex = ''
  for (const b of buf) hex += b.toString(16).padStart(2, '0')
  return hex
}

export function randomInt(): number {
  return crypto.getRandomValues(new Int32Array(1))[0]
}

export function randomIndex(length: number): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError('length must be a positive integer')
  }
  const max = 0x1_0000_0000
  const limit = max - (max % length)
  const buffer = new Uint32Array(1)

  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)

  return buffer[0] % length
}
