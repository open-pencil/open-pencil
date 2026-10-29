import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import { toUint8Array } from 'js-base64'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  isShaderFrameCurrent,
  shaderFramePixels,
  shaderOfPaint,
  shaderPresetKey,
  withShaderPaints,
  type ShaderPaint
} from '@open-pencil/scene-graph/shaders'

import type { ShaderStillPage } from './page'

/**
 * Headless Chromium has WebGPU only with SwiftShader, and only on a secure origin. On Linux,
 * where the deploy and preview workflows build the demo, WebGPU also needs Vulkan, served by
 * SwiftShader since the runners have no GPU.
 */
const BROWSER_ARGS = [
  '--enable-unsafe-webgpu',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  ...(process.platform === 'linux'
    ? ['--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader']
    : [])
]

interface Job {
  node: SceneNode
  shader: ShaderPaint
}

/** The shaders of `node`'s paints whose frame is missing or drawn for another size or preset. */
function staleShaders(graph: SceneGraph, node: SceneNode): ShaderPaint[] {
  const size = { width: node.width, height: node.height }
  return [...node.fills, ...node.strokes].flatMap((paint) => {
    const shader = shaderOfPaint(node, paint)
    if (!shader) return []
    return isShaderFrameCurrent(shader, size) && graph.images.has(shader.image) ? [] : [shader]
  })
}

/** The still page as one HTML document and its script, served from a loopback port. */
async function serveStillPage() {
  const built = await Bun.build({
    entrypoints: [fileURLToPath(new URL('page.ts', import.meta.url))],
    target: 'browser'
  })
  const [script] = built.outputs
  if (!built.success || !script) {
    throw new Error(
      built.logs.map((log) => log.message).join('\n') || 'The still page did not build'
    )
  }
  const js = await script.text()
  const html = '<!doctype html><meta charset="utf-8"><script type="module" src="/page.js"></script>'
  return Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (request) =>
      new URL(request.url).pathname === '/page.js'
        ? new Response(js, { headers: { 'content-type': 'text/javascript' } })
        : new Response(html, { headers: { 'content-type': 'text/html' } })
  })
}

/**
 * Draw the first frame of every shader paint in `graph` whose frame is missing or stale, as
 * the editor would on opening the document, and store it as the paint's image. Needs the
 * Playwright Chromium; without it the frames are left for the editor to draw, which it does in
 * browsers with WebGPU.
 */
export async function drawShaderStills(graph: SceneGraph): Promise<number> {
  const jobs: Job[] = [...graph.getAllNodes()].flatMap((node) =>
    staleShaders(graph, node).map((shader) => ({ node, shader }))
  )
  if (jobs.length === 0) return 0
  const server = await serveStillPage()
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${server.port}/`)
    await page.waitForFunction(() => Reflect.has(window, 'shaderStill'))
    for (const { node, shader } of jobs) {
      const pixels = shaderFramePixels(node)
      // Runs in the page, so the check is written out here rather than shared.
      const dataURL = await page.evaluate(
        ({ preset, width, height }) => {
          const api: unknown = Reflect.get(window, 'shaderStill')
          if (typeof api !== 'object' || api === null || !('renderStill' in api)) {
            throw new Error('The still page did not load')
          }
          const render = api.renderStill as ShaderStillPage['renderStill']
          return render(preset, width, height)
        },
        { preset: shader.preset, ...pixels }
      )
      const [, encoded = ''] = dataURL.split(',')
      graph.images.set(shader.image, toUint8Array(encoded))
      const current = graph.getNode(node.id)
      if (!current) continue
      const frame = {
        width: node.width,
        height: node.height,
        preset: shaderPresetKey(shader.preset)
      }
      graph.updateNode(node.id, {
        pluginData: withShaderPaints(
          current,
          [...current.fills, ...current.strokes],
          [{ ...shader, frame }]
        )
      })
    }
    return jobs.length
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
    console.warn(
      `Shader frames were not drawn (${reason}); the editor draws them when the demo opens in a browser with WebGPU.`
    )
    return 0
  } finally {
    await browser?.close()
    server.stop(true)
  }
}
