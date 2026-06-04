import { expect, test } from 'bun:test'

import { deflateSync } from 'fflate'

import type {
  EncodeError,
  EncodeRequest,
  EncodeResult
} from '#core/io/formats/fig/export-encode-worker'
import { getCompiledSchema, getSchemaBytes, initCodec } from '#core/kiwi/fig/codec'
import { ByteBuffer, compileSchema, decodeBinarySchema } from '#core/kiwi/schema-runtime'

async function runEncodeWorker(req: EncodeRequest): Promise<EncodeResult> {
  const workerUrl = new URL(
    '../../../../packages/core/src/io/formats/fig/export-encode-worker.ts',
    import.meta.url
  )
  const worker = new Worker(workerUrl.href, { type: 'module' })

  try {
    return await new Promise<EncodeResult>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<EncodeResult | EncodeError>) => {
        if (event.data.ok) {
          resolve(event.data)
          return
        }
        reject(new Error(event.data.error))
      }
      worker.onerror = (event) => reject(new Error(event.message))
      // eslint-disable-next-line unicorn/require-post-message-target-origin -- Worker.postMessage has no targetOrigin parameter.
      worker.postMessage(req)
    })
  } finally {
    worker.terminate()
  }
}

test(
  'encode worker produces identical kiwi bytes and schema for default codec schema',
  async () => {
    await initCodec()
    const compiled = getCompiledSchema()

    const msg = {
      type: 'NODE_CHANGES',
      sessionID: 0,
      ackID: 0,
      nodeChanges: [
        {
          guid: { sessionID: 0, localID: 1 },
          phase: 'CREATED' as const,
          type: 'FRAME',
          name: 'Encode Worker Frame'
        }
      ]
    }

    const workerResult = await runEncodeWorker({ msg })

    expect(workerResult.kiwiData).toEqual(compiled.encodeMessage(msg))
    expect(workerResult.schemaDeflated).toEqual(deflateSync(getSchemaBytes()))
  },
  30_000
)

test(
  'encode worker preserves provided deflated schema bytes and matches imported-schema encode',
  async () => {
    await initCodec()
    const schemaDeflated = deflateSync(getSchemaBytes())
    const compiled = compileSchema(
      decodeBinarySchema(new ByteBuffer(new Uint8Array(getSchemaBytes())))
    ) as ReturnType<typeof getCompiledSchema>

    const msg = {
      type: 'NODE_CHANGES',
      sessionID: 0,
      ackID: 0,
      nodeChanges: [
        {
          guid: { sessionID: 0, localID: 1 },
          phase: 'CREATED' as const,
          type: 'DOCUMENT',
          name: 'Imported Schema Document'
        },
        {
          guid: { sessionID: 0, localID: 2 },
          phase: 'CREATED' as const,
          parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
          type: 'CANVAS',
          name: 'Imported Schema Page'
        }
      ]
    }

    const workerResult = await runEncodeWorker({ msg, figSchemaDeflated: schemaDeflated })

    expect(workerResult.kiwiData).toEqual(compiled.encodeMessage(msg))
    expect(workerResult.schemaDeflated).toEqual(schemaDeflated)
  },
  30_000
)

test(
  'encode worker produces byte-identical kiwi for messages with variable bindings',
  async () => {
    const { initCodec, getCompiledSchema } = await import('#core/kiwi/fig/codec')
    await initCodec()
    const compiled = getCompiledSchema()

    const msg = {
      type: 'NODE_CHANGES',
      sessionID: 0,
      ackID: 0,
      nodeChanges: [
        {
          guid: { sessionID: 0, localID: 1 },
          phase: 'CREATED' as const,
          type: 'FRAME',
          name: 'Bound Frame',
          fillPaints: [
            {
              type: 'SOLID',
              color: { r: 1, g: 0, b: 0, a: 1 },
              opacity: 1,
              visible: true,
              blendMode: 'NORMAL',
              colorVariableBinding: { variableID: { sessionID: 0, localID: 99 } }
            }
          ]
        }
      ]
    }

    const mainKiwi = compiled.encodeMessage(msg)
    const workerResult = await runEncodeWorker({ msg, figSchemaDeflated: undefined })
    expect(workerResult.kiwiData).toEqual(mainKiwi)
  },
  30_000
)

test(
  'encode worker produces byte-identical kiwi for messages with blobs',
  async () => {
    const { initCodec, getCompiledSchema } = await import('#core/kiwi/fig/codec')
    await initCodec()
    const compiled = getCompiledSchema()

    const blobBytes = new Uint8Array([1, 2, 3, 4, 5])
    const msg = {
      type: 'NODE_CHANGES',
      sessionID: 0,
      ackID: 0,
      nodeChanges: [
        {
          guid: { sessionID: 0, localID: 1 },
          phase: 'CREATED' as const,
          type: 'VECTOR',
          name: 'Blob carrier'
        }
      ],
      blobs: [{ bytes: blobBytes }]
    }

    const mainKiwi = compiled.encodeMessage(msg)
    const workerResult = await runEncodeWorker({ msg, figSchemaDeflated: undefined })
    expect(workerResult.kiwiData).toEqual(mainKiwi)
  },
  30_000
)
