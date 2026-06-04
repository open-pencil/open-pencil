import { deflateSync, inflateSync } from 'fflate'

import { initCodec, getCompiledSchema, getSchemaBytes } from '#core/kiwi/fig/codec'
import { ByteBuffer, compileSchema, decodeBinarySchema } from '#core/kiwi/schema-runtime'

interface EncodeRequest {
  msg: unknown
  figSchemaDeflated?: Uint8Array
}

interface EncodeResult {
  ok: true
  kiwiData: Uint8Array
  schemaDeflated: Uint8Array
}

interface EncodeError {
  ok: false
  error: string
}

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  try {
    await initCodec()

    let compiled: ReturnType<typeof getCompiledSchema>
    let schemaDeflated: Uint8Array

    if (event.data.figSchemaDeflated) {
      const schemaBytes = inflateSync(event.data.figSchemaDeflated)
      const figSchema = decodeBinarySchema(new ByteBuffer(schemaBytes))
      compiled = compileSchema(figSchema) as ReturnType<typeof getCompiledSchema>
      schemaDeflated = event.data.figSchemaDeflated
    } else {
      compiled = getCompiledSchema()
      schemaDeflated = deflateSync(getSchemaBytes())
    }

    const result: EncodeResult = {
      ok: true,
      // Preserve exportFigFile's existing raw kiwi encode path for byte-identical output.
      kiwiData: compiled.encodeMessage(event.data.msg),
      schemaDeflated
    }
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage has no targetOrigin.
    self.postMessage(result)
  } catch (error) {
    const result: EncodeError = {
      ok: false,
      error:
        error instanceof Error ? `${error.message}\n${error.stack ?? ''}`.trim() : String(error)
    }
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage has no targetOrigin.
    self.postMessage(result)
  }
}

export type { EncodeRequest, EncodeResult, EncodeError }
