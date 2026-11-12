/** `wOF2`, the signature a WOFF2 file starts with. */
const WOFF2_SIGNATURE = 0x774f4632

export function isWOFF2(data: ArrayBuffer): boolean {
  return data.byteLength >= 4 && new DataView(data).getUint32(0) === WOFF2_SIGNATURE
}

/**
 * The font as an sfnt (TrueType or OpenType) file. CanvasKit draws WOFF2, but HarfBuzz, the PDF
 * exporter, and the font table readers need the tables themselves, so a WOFF2 font is decompressed
 * with Google's reference decoder, loaded only when one arrives. Other files stay as they are.
 */
export async function sfntFont(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isWOFF2(data)) return data
  const { default: decompress } = await import('woff2-encoder/decompress')
  return new Uint8Array(await decompress(data)).buffer
}
