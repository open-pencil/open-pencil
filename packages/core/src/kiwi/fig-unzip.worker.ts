/** Stage 1: Unzip .fig buffer → schema bytes + kiwi data + images. */
import { unzipSync, inflateSync } from 'fflate'
import { parseFigKiwiContainer } from './fig-file'
import { profileStage, profileStart, getFigParseProfile, clearFigParseProfile } from './fig-parse-profile'

interface Input { buffer: ArrayBuffer; profile?: boolean }

self.onmessage = (e: MessageEvent<Input>) => {
  const { buffer, profile } = e.data
  if (profile) {
    ;(globalThis as unknown as { __FIG_PARSE_PROFILE__: boolean }).__FIG_PARSE_PROFILE__ = true
    clearFigParseProfile()
  }

  try {
    const t0 = profileStart()
    const zip = unzipSync(new Uint8Array(buffer), {
      filter: (file) =>
        file.name === 'canvas.fig' ||
        file.name === 'canvas' ||
        (file.name.startsWith('images/') && file.name !== 'images/')
    })
    profileStage('1_unzipSync', t0)

    const entries = Object.keys(zip)
    let canvasData: Uint8Array | null = null
    for (const name of entries) {
      if (name === 'canvas.fig' || name === 'canvas') { canvasData = zip[name]; break }
    }
    if (!canvasData) {
      let maxSize = 0
      for (const name of entries) {
        const lower = name.toLowerCase()
        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.json')) continue
        if (zip[name].byteLength > maxSize) { maxSize = zip[name].byteLength; canvasData = zip[name] }
      }
    }
    if (!canvasData) throw new Error(`No canvas data found. Entries: ${entries.join(', ')}`)

    const payload = parseFigKiwiContainer(canvasData)
    if (!payload) throw new Error('Invalid fig-kiwi container')

    const t1 = profileStart()
    const schemaBytes = inflateSync(payload.schemaDeflated)
    profileStage('2_inflateSchema', t1)

    const images: Array<[string, Uint8Array]> = []
    for (const name of entries) {
      if (name.startsWith('images/') && name !== 'images/') {
        images.push([name.replace('images/', ''), zip[name]])
      }
    }

    // Transfer all ArrayBuffers (zero-copy)
    const transferables: Transferable[] = []
    const seen = new Set<ArrayBuffer>()
    for (const buf of [schemaBytes.buffer as ArrayBuffer, payload.dataRaw.buffer as ArrayBuffer]) {
      if (!seen.has(buf)) { seen.add(buf); transferables.push(buf) }
    }
    for (const [, bytes] of images) {
      const buf = bytes.buffer as ArrayBuffer
      if (!seen.has(buf)) { seen.add(buf); transferables.push(buf) }
    }

    self.postMessage(
      { type: 'success', schemaBytes, dataRaw: payload.dataRaw, images, profile: profile ? getFigParseProfile() : undefined },
      { transfer: transferables }
    )
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
