import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { exportSVGOrThrow, makeGraph, pageId } from './helpers'

const base64ModuleUrl = pathToFileURL(
  resolve(import.meta.dir, '../../../../../packages/core/src/io/base64.ts')
).href

async function runWithoutBuffer(body: string) {
  const process = Bun.spawn(
    [
      'bun',
      '-e',
      `globalThis.Buffer = undefined
const { uint8ArrayToBase64 } = await import(${JSON.stringify(base64ModuleUrl)})
${body}`
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited
  ])
  return { stdout, stderr, exitCode }
}

test('embeds large image fills without overflowing the call stack', () => {
  const graph = makeGraph()
  const imageHash = 'large-png'
  const imageBytes = new Uint8Array(2_700_000)
  imageBytes.set([0x89, 0x50, 0x4e, 0x47])
  imageBytes.fill(0xa5, 4)
  graph.images.set(imageHash, imageBytes)

  const node = graph.createNode('RECTANGLE', pageId(graph), {
    width: 100,
    height: 100,
    fills: [
      {
        type: 'IMAGE',
        imageHash,
        imageScaleMode: 'FILL',
        color: { r: 0, g: 0, b: 0, a: 0 },
        opacity: 1,
        visible: true
      }
    ]
  })

  const result = exportSVGOrThrow(graph, [node.id])
  const encoded = Buffer.from(imageBytes).toString('base64')
  expect(result).toContain(`href="data:image/png;base64,${encoded}"`)
})

test('chunks large payloads when Buffer is unavailable', async () => {
  const size = 100_000
  const bytes = Uint8Array.from({ length: size }, (_, index) => index % 251)
  const result = await runWithoutBuffer(`
const bytes = Uint8Array.from({ length: ${size} }, (_, index) => index % 251)
process.stdout.write(uint8ArrayToBase64(bytes))`)

  expect(result.exitCode).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout).toBe(Buffer.from(bytes).toString('base64'))
})

test('reports an unsupported environment without Buffer or btoa', async () => {
  const result = await runWithoutBuffer(`
globalThis.btoa = undefined
try {
  uint8ArrayToBase64(new Uint8Array([1, 2, 3]))
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error))
  process.exit(7)
}`)

  expect(result.exitCode).toBe(7)
  expect(result.stdout).toBe('')
  expect(result.stderr).toBe('Base64 encoding is unavailable in this environment')
})
