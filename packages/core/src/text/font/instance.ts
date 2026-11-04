import type { FontVariation } from '@open-pencil/scene-graph'

import { loadHarfBuzzSubsetter } from './harfbuzz'
import { fontAxes } from './variation'

/** HarfBuzz lets a blob read the bytes it is given in place, and frees nothing. */
const HB_MEMORY_MODE_WRITABLE = 2

/** A four-letter axis tag as HarfBuzz's 32-bit number. */
function axisTag(tag: string): number {
  return Array.from(tag.padEnd(4).slice(0, 4)).reduce(
    (value, character) => value * 256 + (character.charCodeAt(0) & 0xff),
    0
  )
}

/**
 * The axis values `variations` draws `data` at: only the axes the font has, each within its
 * range, in the font's order, so equal instances compare equal. Empty for a static font.
 */
export function fontInstanceVariations(
  data: ArrayBuffer,
  variations: readonly FontVariation[]
): FontVariation[] {
  const set = new Map(variations.map(({ axis, value }) => [axis, value]))
  return (fontAxes(data) ?? []).flatMap((axis) => {
    const value = set.get(axis.tag)
    return value === undefined
      ? []
      : [{ axis: axis.tag, value: Math.min(axis.max, Math.max(axis.min, value)) }]
  })
}

/**
 * A static font file drawing `data`'s instance at `variations`, every other axis at its default,
 * as HarfBuzz's instancer cuts it. Null when HarfBuzz cannot cut the file.
 */
export async function staticFontInstance(
  data: ArrayBuffer,
  variations: readonly FontVariation[]
): Promise<ArrayBuffer | null> {
  const hb = await loadHarfBuzzSubsetter()
  const source = hb.malloc(data.byteLength)
  new Uint8Array(hb.memory.buffer).set(new Uint8Array(data), source)
  const blob = hb.hb_blob_create(source, data.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0)
  const face = hb.hb_face_create(blob, 0)
  hb.hb_blob_destroy(blob)
  const input = hb.hb_subset_input_create_or_fail()
  hb.hb_subset_input_keep_everything(input)
  hb.hb_subset_input_pin_all_axes_to_default(input, face)
  for (const { axis, value } of variations) {
    hb.hb_subset_input_pin_axis_location(input, face, axisTag(axis), value)
  }
  const instance = hb.hb_subset_or_fail(face, input)
  hb.hb_subset_input_destroy(input)
  hb.hb_face_destroy(face)
  hb.free(source)
  if (!instance) return null
  const output = hb.hb_face_reference_blob(instance)
  const length = hb.malloc(4)
  const start = hb.hb_blob_get_data(output, length)
  // The subsetter may have grown its memory, so views are taken after it ran.
  const size = new DataView(hb.memory.buffer).getUint32(length, true)
  const file = new Uint8Array(hb.memory.buffer).slice(start, start + size).buffer
  hb.free(length)
  hb.hb_blob_destroy(output)
  hb.hb_face_destroy(instance)
  return size > 0 ? file : null
}
