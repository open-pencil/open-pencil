import { expect, spyOn, test } from 'bun:test'

import { exportFigFile, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { parseFigFileInWorker, parseFigFileViaWorker } from '#core/io/formats/fig/read'
import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'

async function twoPageFile(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { text: 'First' })
  source.createNode('TEXT', source.addPage('Second').id, { text: 'Second' })
  return exportFigFile(source)
}

function secondPageText(graph: SceneGraph): string | undefined {
  const second = graph.getPages()[1]
  return graph.getChildren(second.id)[0]?.text
}

function workerFailingAfterTransfer(): Worker {
  const worker: Worker = {
    terminate: () => undefined,
    postMessage: (message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) => {
      structuredClone(message, Array.isArray(transfer) ? { transfer } : transfer)
      queueMicrotask(() => worker.onerror?.(new ErrorEvent('error', { message: 'Worker crashed' })))
    },
    onerror: null,
    onmessage: null,
    onmessageerror: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true
  }
  return worker
}

test('the worker takes the file instead of a copy, and the main thread still loads pages', async () => {
  const bytes = await twoPageFile()
  const buffer = bytes.slice().buffer

  const opened = await parseFigFileViaWorker(buffer, { populate: 'first-page' })
  try {
    expect(buffer.byteLength).toBe(0)
    expect(secondPageText(opened)).toBeUndefined()
    expect(populateFigPage(opened, opened.getPages()[1].id)).toBe(true)
    expect(secondPageText(opened)).toBe('Second')
    expect(await exportFigFile(opened)).toEqual(bytes)
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('a worker that fails after taking the file falls back to reading it again', async () => {
  const bytes = await twoPageFile()
  const buffer = bytes.slice().buffer
  let reads = 0
  const readAgain = async () => {
    reads++
    return bytes.slice().buffer
  }
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)

  try {
    const opened = await parseFigFileInWorker(
      buffer,
      { populate: 'first-page' },
      readAgain,
      workerFailingAfterTransfer
    )
    expect(buffer.byteLength).toBe(0)
    expect(reads).toBe(1)
    expect(opened.getChildren(opened.getPages()[0].id)[0]?.text).toBe('First')
    expect(populateFigPage(opened, opened.getPages()[1].id)).toBe(true)
    expect(secondPageText(opened)).toBe('Second')
    releaseFigPopulationWorker(opened)
  } finally {
    warn.mockRestore()
  }
}, 20000)

test('a file that cannot be read again after the worker failed says it changed while opening', async () => {
  const buffer = (await twoPageFile()).slice().buffer
  const unreadable = new DOMException('The file was modified', 'NotReadableError')
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)

  try {
    const opening = parseFigFileInWorker(
      buffer,
      { populate: 'first-page' },
      () => Promise.reject(unreadable),
      workerFailingAfterTransfer
    )
    await expect(opening).rejects.toThrow('The file changed while it was opening. Open it again.')
    await expect(opening).rejects.toMatchObject({ cause: unreadable })
  } finally {
    warn.mockRestore()
  }
}, 20000)

test('a worker that cannot start leaves the file to the main thread without reading it again', async () => {
  const bytes = await twoPageFile()
  const buffer = bytes.slice().buffer
  let reads = 0
  const readAgain = async () => {
    reads++
    return bytes.slice().buffer
  }
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)

  try {
    const opened = await parseFigFileInWorker(buffer, { populate: 'first-page' }, readAgain, () => {
      throw new Error('Workers are blocked')
    })
    expect(reads).toBe(0)
    expect(opened.getChildren(opened.getPages()[0].id)[0]?.text).toBe('First')
    releaseFigPopulationWorker(opened)
  } finally {
    warn.mockRestore()
  }
}, 20000)
