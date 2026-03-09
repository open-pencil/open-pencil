/** Stage 2: Kiwi decode + importNodeChanges → serialized SceneGraph. */
import { importNodeChanges } from './fig-import'
import { decodeBinarySchema, compileSchema, ByteBuffer } from './kiwi-schema'
import { profileStage, profileStart, getFigParseProfile, clearFigParseProfile } from './fig-parse-profile'
import type { FigmaMessage } from './codec'

interface Input {
  schemaBytes: Uint8Array
  dataRaw: Uint8Array
  images: Array<[string, Uint8Array]>
  profile?: boolean
}

self.onmessage = async (e: MessageEvent<Input>) => {
  const { schemaBytes, dataRaw, images: imageEntries, profile } = e.data
  if (profile) {
    ;(globalThis as unknown as { __FIG_PARSE_PROFILE__: boolean }).__FIG_PARSE_PROFILE__ = true
    clearFigParseProfile()
  }

  try {
    let message: FigmaMessage
    const t0 = profileStart()
    try {
      const wasm = await import('@open-pencil/kiwi-wasm')
      await wasm.default()
      message = wasm.decode_figma_message(schemaBytes, dataRaw) as FigmaMessage
      profileStage('3_kiwiDecode_wasm', t0)
    } catch {
      const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
      const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): unknown }
      message = compiled.decodeMessage(dataRaw) as FigmaMessage
      profileStage('3_kiwiDecode_js', t0)
    }

    const nodeChanges = message.nodeChanges
    if (!nodeChanges || nodeChanges.length === 0) {
      throw new Error('No nodes found in .fig file')
    }

    const blobs: Uint8Array[] = (
      ((message as unknown as Record<string, unknown>).blobs as Array<{ bytes: Uint8Array }>) ?? []
    ).map((b) =>
      b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes) as number[])
    )

    const images = new Map<string, Uint8Array>()
    for (const [hash, data] of imageEntries) {
      images.set(hash, data)
    }

    const t1 = profileStart()
    const graph = importNodeChanges(nodeChanges, blobs, images)
    profileStage('4_importNodeChanges', t1)

    const data = {
      nodes: [...graph.nodes.entries()],
      images: [...graph.images.entries()],
      variables: [...graph.variables.entries()],
      variableCollections: [...graph.variableCollections.entries()],
      activeMode: [...graph.activeMode.entries()],
      rootId: graph.rootId
    }

    const transferables: Transferable[] = []
    const seen = new Set<ArrayBuffer>()
    for (const [, bytes] of data.images) {
      const buf = bytes.buffer as ArrayBuffer
      if (!seen.has(buf)) { seen.add(buf); transferables.push(buf) }
    }

    self.postMessage(
      { type: 'success', data, profile: profile ? getFigParseProfile() : undefined },
      { transfer: transferables }
    )
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
