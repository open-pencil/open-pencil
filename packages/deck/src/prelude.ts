export const FIG_KIWI_PRELUDE = 'fig-kiwi'
export const FIG_DECK_PRELUDE = 'fig-deck'

/** Rewrite `fig-deck` → `fig-kiwi` so the shared kiwi decoder can open the container. */
export function normalizeDeckCanvasPrelude(canvasData: Uint8Array): Uint8Array {
  if (canvasData.byteLength < 8) {
    throw new Error('Invalid deck canvas: too short for a fig container prelude')
  }
  const header = new TextDecoder().decode(canvasData.subarray(0, 8))
  if (header === FIG_KIWI_PRELUDE) return canvasData
  if (header === FIG_DECK_PRELUDE) {
    const out = new Uint8Array(canvasData)
    out.set(new TextEncoder().encode(FIG_KIWI_PRELUDE), 0)
    return out
  }
  throw new Error(`Invalid deck canvas prelude: expected fig-deck or fig-kiwi, got ${JSON.stringify(header)}`)
}

/** Set the 8-byte container prelude (e.g. to `fig-deck` before writing). */
export function setCanvasPrelude(canvasData: Uint8Array, prelude: string): Uint8Array {
  if (prelude.length !== 8) throw new Error(`Prelude must be 8 bytes, got ${prelude.length}`)
  if (canvasData.byteLength < 8) throw new Error('Canvas data too short to set prelude')
  const out = new Uint8Array(canvasData)
  out.set(new TextEncoder().encode(prelude), 0)
  return out
}

export function readCanvasPrelude(canvasData: Uint8Array): string {
  if (canvasData.byteLength < 8) return ''
  return new TextDecoder().decode(canvasData.subarray(0, 8))
}
