import { deflateSync, inflateSync } from 'fflate'

export const FIG_KIWI_DEFAULT_VERSION = 101

export function parseFigKiwiChunks(binary: Uint8Array): Uint8Array[] | null {
  const header = new TextDecoder().decode(binary.slice(0, 8))
  if (header !== 'fig-kiwi') return null

  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)
  let offset = 12

  const chunks: Uint8Array[] = []
  while (offset < binary.length) {
    const chunkLen = view.getUint32(offset, true)
    offset += 4
    chunks.push(binary.slice(offset, offset + chunkLen))
    offset += chunkLen
  }
  return chunks.length >= 2 ? chunks : null
}

export function decompressFigKiwiData(compressed: Uint8Array): Uint8Array {
  try {
    return inflateSync(compressed)
  } catch {
    throw new Error('Failed to decompress fig-kiwi data')
  }
}

export async function decompressFigKiwiDataAsync(compressed: Uint8Array): Promise<Uint8Array> {
  try {
    return inflateSync(compressed)
  } catch {
    const fzstd = await import('fzstd')
    return fzstd.decompress(compressed)
  }
}

export function buildFigKiwi(
  schemaDeflated: Uint8Array,
  dataRaw: Uint8Array,
  version = FIG_KIWI_DEFAULT_VERSION
): Uint8Array {
  const dataDeflated = deflateSync(dataRaw)

  const total = 8 + 4 + 4 + schemaDeflated.length + 4 + dataDeflated.length
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)

  out.set(new TextEncoder().encode('fig-kiwi'), 0)
  view.setUint32(8, version, true)

  let offset = 12
  view.setUint32(offset, schemaDeflated.length, true)
  offset += 4
  out.set(schemaDeflated, offset)
  offset += schemaDeflated.length

  view.setUint32(offset, dataDeflated.length, true)
  offset += 4
  out.set(dataDeflated, offset)

  return out
}
