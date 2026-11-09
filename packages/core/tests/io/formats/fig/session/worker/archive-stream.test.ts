import { expect, test } from 'bun:test'

import type { FigPatchedArchiveInput, FigRecordPatch } from '@open-pencil/fig'

import { workerFigArchive, type FigArchiveAccess } from '#core/kiwi/fig/session/archive/access'
import type { FigSessionRequest, FigSessionResponse } from '#core/kiwi/fig/session/protocol'

const PATCH: FigRecordPatch = { records: [], blobs: [], removed: [], replaceVariables: false }
const INPUT: FigPatchedArchiveInput = {
  thumbnailPNG: new Uint8Array(),
  metaJSON: '{}',
  images: []
}

function unused(): never {
  throw new Error('The fallback is not expected here')
}

function fallback(): FigArchiveAccess {
  return {
    original: unused,
    info: unused,
    componentPages: unused,
    recordPages: unused,
    patch: unused,
    patchStream: unused,
    close: () => undefined
  }
}

function fakeWorker() {
  return {
    terminated: false,
    terminate() {
      this.terminated = true
    },
    addEventListener: () => undefined
  }
}

async function nextStreamRequest(
  port: MessagePort
): Promise<Extract<FigSessionRequest, { type: 'patch-archive-stream' }>> {
  return new Promise((resolve) => {
    port.onmessage = (event: MessageEvent<FigSessionResponse>) => {
      if (event.data.type === 'patch-archive-stream') resolve(event.data)
    }
  })
}

test('a failing sink rejects the streamed save and acknowledges it', async () => {
  const { port1, port2 } = new MessageChannel()
  const worker = fakeWorker()
  const access = workerFigArchive(port1, worker, fallback)
  const messages: FigSessionResponse[] = []
  const request = new Promise<Extract<FigSessionRequest, { type: 'patch-archive-stream' }>>(
    (resolve) => {
      port2.onmessage = (event: MessageEvent<FigSessionResponse>) => {
        messages.push(event.data)
        if (event.data.type === 'patch-archive-stream') resolve(event.data)
      }
    }
  )

  const save = access.patchStream(
    PATCH,
    INPUT,
    () => {
      throw new Error('sink failed')
    },
    undefined
  )
  const stream = await request
  port2.postMessage({
    type: 'patch-archive-chunk',
    requestId: stream.requestId,
    bytes: new Uint8Array([1, 2, 3])
  })

  await expect(save).rejects.toThrow('sink failed')
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(messages).toContainEqual({
    type: 'patch-archive-ack',
    requestId: stream.requestId,
    ok: false
  })
  access.close()
  expect(worker.terminated).toBe(true)
})

test('closing the archive rejects a streamed save in flight', async () => {
  const { port1, port2 } = new MessageChannel()
  const worker = fakeWorker()
  const access = workerFigArchive(port1, worker, fallback)
  const request = nextStreamRequest(port2)

  const save = access.patchStream(PATCH, INPUT, () => undefined, undefined)
  await request
  access.close()

  await expect(save).rejects.toThrow('The document closed')
  expect(worker.terminated).toBe(true)
})
