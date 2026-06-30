export function computeImageHash(data: Uint8Array): string {
  let h1 = 0x811c9dc5 >>> 0
  let h2 = 0x811c9dc5 >>> 0
  let h3 = 0x811c9dc5 >>> 0
  let h4 = 0x811c9dc5 >>> 0
  let h5 = 0x811c9dc5 >>> 0
  for (let i = 0; i < data.length; i++) {
    const b = data[i]
    switch (i % 5) {
      case 0:
        h1 ^= b
        h1 = Math.imul(h1, 0x01000193) >>> 0
        break
      case 1:
        h2 ^= b
        h2 = Math.imul(h2, 0x01000193) >>> 0
        break
      case 2:
        h3 ^= b
        h3 = Math.imul(h3, 0x01000193) >>> 0
        break
      case 3:
        h4 ^= b
        h4 = Math.imul(h4, 0x01000193) >>> 0
        break
      default:
        h5 ^= b
        h5 = Math.imul(h5, 0x01000193) >>> 0
        break
    }
  }
  h5 = Math.imul(h5 ^ data.length, 0x01000193) >>> 0
  return [h1, h2, h3, h4, h5].map((hash) => hash.toString(16).padStart(8, '0')).join('')
}
