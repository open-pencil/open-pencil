/**
 * The background-removal model: ISNet general use, int8 weights (MIT, about 44 MB), run on the
 * device with Transformers.js, on the GPU where WebGPU is available. It loads on first use, then
 * stays cached by the browser, so it works offline afterwards.
 */
const MODEL_ID = 'xrds/isnet-general-onnx-int8'

type Segmenter = (image: Blob) => Promise<unknown>

let segmenter: Promise<Segmenter> | null = null

/** WebGPU only counts with a real adapter; some browsers expose `navigator.gpu` without one. */
async function hasWebGPUAdapter(): Promise<boolean> {
  if (!('gpu' in navigator)) return false
  try {
    return (await navigator.gpu.requestAdapter()) !== null
  } catch {
    return false
  }
}

/** Loads the model once; the heavy library is split out and fetched only by this call. */
function loadSegmenter(): Promise<Segmenter> {
  segmenter ??= import('@huggingface/transformers').then(async ({ pipeline, RawImage }) => {
    const device = (await hasWebGPUAdapter()) ? 'webgpu' : 'wasm'
    const run = await pipeline('background-removal', MODEL_ID, { device, dtype: 'q8' })
    return async (image: Blob) => run(await RawImage.fromBlob(image))
  })
  segmenter.catch(() => {
    segmenter = null
  })
  return segmenter
}

interface MaskImage {
  width: number
  height: number
  channels: number
  data: Uint8Array | Uint8ClampedArray
}

function isMaskImage(value: unknown): value is MaskImage {
  if (typeof value !== 'object' || value === null) return false
  return 'width' in value && 'height' in value && 'channels' in value && 'data' in value
}

/**
 * The image with its background made transparent, as PNG. The model returns the cut-out image
 * (RGBA) at the source size; its alpha is the subject mask.
 */
export async function removeImageBackground(bytes: Uint8Array): Promise<Uint8Array> {
  const run = await loadSegmenter()
  const output = await run(new Blob([bytes.slice().buffer]))
  const result: unknown = Array.isArray(output) ? output[0] : output
  if (!isMaskImage(result) || result.channels !== 4) {
    throw new Error('The model returned no image')
  }
  const canvas = new OffscreenCanvas(result.width, result.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D canvas')
  const pixels = new ImageData(result.width, result.height)
  pixels.data.set(result.data)
  ctx.putImageData(pixels, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await blob.arrayBuffer())
}
