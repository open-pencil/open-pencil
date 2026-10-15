/**
 * Framing shared by both identity envelopes.
 *
 * Body identity and metadata identity hash different fields, but they must
 * frame them the same way: a length prefix before every part, so no
 * concatenation of values can be mistaken for a different one, and one hex
 * digest format. Two copies of this drifting apart would let the same document
 * hash differently on two devices, which is a conflict that never resolves.
 */

/** Big-endian, so a length prefix sorts and compares the same everywhere. */
export function encodeLength(value: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, value, false)
  return out
}

export function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function concatParts(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const envelope = new Uint8Array(new ArrayBuffer(total))
  let offset = 0
  for (const part of parts) {
    envelope.set(part, offset)
    offset += part.byteLength
  }
  return envelope
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Prefixed so a stored identity always declares the algorithm that made it. */
export async function hashEnvelope(envelope: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', envelope)
  return `sha256:${toHex(digest)}`
}
